import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { AccessError, broker, type Identity } from "./protocol.server";

/** Prove ownership with a temporary native session. Never persist or return its tokens. */
export async function verifyNativeAccount(
  auth: SupabaseClient,
  email: unknown,
  password: unknown,
) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    typeof password !== "string" ||
    !password ||
    password.length > 512
  )
    throw new AccessError(
      "Ingresá el email y la contraseña de tu cuenta.",
      400,
    );
  try {
    const result = await auth.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (result.error || !result.data.session)
      throw new AccessError("El email o la contraseña no son correctos.", 401);
    const verified = await auth.auth.getUser(result.data.session.access_token);
    const user = verified.data.user;
    if (verified.error || !user || !user.email_confirmed_at)
      throw new AccessError("No se pudo verificar la cuenta.", 401);
    if (user.factors?.some((factor) => factor.status === "verified"))
      throw new AccessError(
        "Esta cuenta tiene doble factor. La vinculación necesita revisión para conservar esa protección.",
      );
    if (user.app_metadata.pbadmin_managed)
      throw new AccessError(
        "Esta cuenta ya utiliza la identidad de PBAdmin. Ingresá con PBAdmin.",
      );
    return user;
  } finally {
    await auth.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

function ownerEmail(identity: Identity) {
  const email = typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";
  if (
    identity.role !== 0 || email.length > 254 || email.endsWith(".invalid") ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw new AccessError("Revisá el correo del administrador en PBAdmin antes de crear la cuenta.", 422);
  return email;
}

export async function reserveAccount(db: SupabaseClient, identity: Identity) {
  if (identity.intent === "open") {
    const current = await db.from("pbadmin_accounts").select("owner_id,account_id,legacy,ready,disconnected_at")
      .eq("owner_id", identity.ownerId).maybeSingle();
    if (current.error) throw new AccessError("No se pudo comprobar la cuenta vinculada.", 503);
    if (!current.data?.ready || current.data.disconnected_at || current.data.account_id !== identity.accountId)
      throw new AccessError("La cuenta vinculada ya no está disponible. Volvé a vincular Builder desde Extensiones.");
    return current.data as { owner_id: number; account_id: string; legacy: boolean; ready: boolean };
  }
  if (identity.intent === "create" && !identity.accountId) ownerEmail(identity);
  const result = await db.rpc("reserve_pbadmin_account", {
    p_owner: identity.ownerId,
    p_existing: identity.accountId,
  });
  if (result.error || !result.data)
    throw new AccessError("La cuenta necesita revisión antes de vincularse.");
  const row = result.data;
  if (identity.accountId && row.account_id !== identity.accountId)
    throw new AccessError(
      "Esta administración ya tiene otra cuenta vinculada.",
    );
  return row as {
    owner_id: number;
    account_id: string;
    legacy: boolean;
    ready: boolean;
  };
}
/** Opening proves both existing identities; only an explicit link/create can provision. */
export async function assertLinkedProfile(
  db: SupabaseClient,
  id: string,
  role: string,
  parentAdminId?: string,
) {
  const [auth, profile] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from("profiles").select(parentAdminId ? "role,admin_id" : "role").eq("id", id).maybeSingle(),
  ]);
  if ((auth.error && auth.error.status !== 404) || profile.error)
    throw new AccessError("No se pudo comprobar la cuenta vinculada. Volvé a intentar.", 503);
  const row = profile.data as { role?: string; admin_id?: string } | null;
  if (!auth.data.user || !row || row.role !== role || (parentAdminId && row.admin_id !== parentAdminId))
    throw new AccessError("La cuenta vinculada ya no está disponible. Volvé a vincularla desde Extensiones.");
}

// The Auth trigger needs the approval before GoTrue applies app_metadata.
// Another signup can hold the same email, so only reuse this reservation's approval.
async function approveManagedSignup(
  db: SupabaseClient,
  id: string,
  email: string,
  requestedBy: string,
  ownerId: number,
) {
  const now = new Date().toISOString();
  const [previousEmail, previousAttempt] = await Promise.all([
    db.from("auth_signup_approvals").delete().eq("email", email).lte("expires_at", now),
    db.from("auth_signup_approvals").delete().eq("user_id", id).lte("expires_at", now),
  ]);
  if (previousEmail.error || previousAttempt.error)
    throw new AccessError("No se pudo preparar el alta del constructor.", 503);
  const approval = await db.from("auth_signup_approvals").upsert(
    { email, user_id: id, requested_by: requestedBy, role: "client" },
    { onConflict: "email", ignoreDuplicates: true },
  );
  if (approval.error) throw new AccessError("Hay un alta pendiente. Volvé a intentar.", 503);
  const [claim, reservation] = await Promise.all([
    db.from("auth_signup_approvals").select("user_id").eq("email", email).maybeSingle(),
    db.from("pbadmin_accounts").select("account_id").eq("owner_id", ownerId).is("disconnected_at", null).maybeSingle(),
  ]);
  if (claim.error || reservation.error) throw new AccessError("No se pudo verificar el alta.", 503);
  return claim.data?.user_id === id && reservation.data?.account_id === id;
}

export async function ensureManagedAuth(
  db: SupabaseClient,
  id: string,
  identity: Identity,
  defaultsAdminId: string | null,
) {
  const ownerId = identity.ownerId;
  const lookup = await db.auth.admin.getUserById(id);
  let user = lookup.data.user;
  if (!user) {
    if (lookup.error && lookup.error.status !== 404)
      throw new AccessError(
        "No se pudo verificar el alta. Volvé a intentar.",
        503,
      );
    if (!defaultsAdminId || identity.intent !== "create" || identity.accountId)
      throw new AccessError("La cuenta vinculada ya no está disponible. Volvé a vincularla desde Extensiones.");
    const email = ownerEmail(identity);
    const approved = await approveManagedSignup(db, id, email, defaultsAdminId, ownerId);
    const created = approved ? await db.auth.admin.createUser({
      id,
      email,
      email_confirm: true,
      password: randomBytes(48).toString("base64url"),
      app_metadata: {
        pbadmin_managed: true,
        pbadmin_owner_id: ownerId,
        pbadmin_kind: "builder",
        panelbot_admin_created: true,
        panelbot_role: "client",
      },
    }) : null;
    user = created?.data.user ?? null;
    if (!user) {
      const retry = await db.auth.admin.getUserById(id);
      user = retry.data.user;
      if (!user && retry.error?.status === 404 && ["email_exists", "user_already_exists"].includes(created?.error?.code ?? "")) {
        // Only discard the unfulfilled create reservation. A subsequent native
        // link must still verify credentials, role and ownership independently.
        const release = await db.from("pbadmin_accounts").delete().eq("owner_id", ownerId)
          .eq("account_id", id).eq("ready", false).eq("legacy", false).is("disconnected_at", null);
        if (release.error) throw new AccessError("No se pudo finalizar el intento de alta.", 503);
        const cleanup = await db.from("auth_signup_approvals").delete().eq("email", email).eq("user_id", id);
        if (cleanup.error) throw new AccessError("No se pudo finalizar el intento de alta.", 503);
        throw new AccessError("Ese correo ya tiene cuenta en Builder. Si es tu cuenta anterior, elegí «Ya tengo cuenta» e ingresá sus credenciales.");
      }
      if (!user) throw new AccessError("Hay un alta pendiente. Volvé a intentar.", 503);
    }
  }
  if (
    user.id !== id ||
    !user.email ||
    user.app_metadata.pbadmin_managed !== true ||
    user.app_metadata.pbadmin_owner_id !== ownerId ||
    user.app_metadata.pbadmin_kind !== "builder"
  )
    throw new AccessError(
      "El alta encontró una cuenta incompatible. Se conserva sin cambios.",
    );
  return user;
}
export async function putOnce(
  db: SupabaseClient,
  table: string,
  values: object,
  conflict: string,
) {
  const result = await db
    .from(table)
    .upsert(values, { onConflict: conflict, ignoreDuplicates: true });
  if (result.error)
    throw new AccessError(
      "El alta quedó pendiente. Podés volver a intentar.",
      503,
    );
}
export async function issueSession(
  db: SupabaseClient,
  authClient: SupabaseClient,
  identity: Identity,
  target: string,
): Promise<Session> {
  const targetUser = (await db.auth.admin.getUserById(target)).data.user;
  if (!targetUser?.email)
    throw new AccessError("La cuenta no está disponible.");
  const link = await db.auth.admin.generateLink({
    type: "magiclink",
    email: targetUser.email,
  });
  if (link.error || link.data.user.id !== target)
    throw new AccessError("No se pudo preparar el acceso.", 503);
  const verified = await authClient.auth.verifyOtp({
    type: "email",
    token_hash: link.data.properties.hashed_token,
  });
  if (
    verified.error ||
    verified.data.user?.id !== target ||
    !verified.data.session
  )
    throw new AccessError("No se pudo abrir la sesión.", 503);
  const session = verified.data.session;
  const claims = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64url").toString(),
  );
  const result = await db.from("pbadmin_sessions").insert({
    session_id: claims.session_id,
    profile_id: target,
    owner_id: identity.ownerId,
    user_id: identity.userId,
    role: identity.role,
    expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
  });
  if (result.error) {
    await db.auth.admin.signOut(session.access_token, "local");
    throw new AccessError("No se pudo registrar la sesión.", 503);
  }
  return session;
}
export async function validateSession(
  db: SupabaseClient,
  provider: Identity["provider"],
  token: string,
) {
  const verified = await db.auth.getUser(token);
  if (verified.error || !verified.data.user)
    throw new AccessError("Volvé a iniciar sesión.", 401);
  const claims = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString(),
  );
  const result = await db
    .from("pbadmin_sessions")
    .select("*")
    .eq("session_id", claims.session_id)
    .maybeSingle();
  if (result.error)
    throw new AccessError("No se pudo verificar tu sesión.", 503);
  const row = result.data;
  if (!row) {
    if (verified.data.user.app_metadata.pbadmin_managed)
      throw new AccessError("Ingresá con tu cuenta PBAdmin.", 401);
    return null; // Native credentials of an existing account remain independent.
  }
  if (
    row.profile_id !== verified.data.user.id ||
    row.revoked ||
    Date.parse(row.expires_at) < Date.now()
  )
    throw new AccessError("Volvé a ingresar desde PBAdmin.", 401);
  const validity = await broker(provider, "validate", {
    userId: row.user_id,
    ownerId: row.owner_id,
    remoteId: row.profile_id,
  });
  if (!validity.valid || Number(validity.role) !== Number(row.role)) {
    await db
      .from("pbadmin_sessions")
      .update({ revoked: true })
      .eq("session_id", row.session_id);
    await db.auth.admin.signOut(token, "local");
    throw new AccessError(
      "Tu acceso cambió. Volvé a ingresar desde PBAdmin.",
      401,
    );
  }
  return row;
}

/** Revoke delegated access after central ownership/role changes, also for idle tabs. */
export async function reconcileSessions(
  db: SupabaseClient,
  provider: Identity["provider"],
  ownerId: number,
) {
  let cursor: string | null = null;
  const decisions = new Map<string, boolean>();
  for (;;) {
    let query = db
      .from("pbadmin_sessions")
      .select("session_id,user_id,profile_id,role")
      .eq("owner_id", ownerId)
      .eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .order("session_id")
      .limit(200);
    if (cursor) query = query.gt("session_id", cursor);
    const page = await query;
    if (page.error)
      throw new AccessError(
        "No se pudo verificar la sincronización de accesos.",
        503,
      );
    if (!page.data.length) return;
    for (const row of page.data) {
      const key = `${row.user_id}:${row.profile_id}:${row.role}`;
      let allowed = decisions.get(key);
      if (allowed === undefined) {
        const result = await broker(provider, "validate", {
          userId: row.user_id,
          ownerId,
          remoteId: row.profile_id,
        });
        allowed = result.valid === true && result.role === row.role;
        decisions.set(key, allowed);
      }
      if (!allowed) {
        const result = await db
          .from("pbadmin_sessions")
          .update({ revoked: true })
          .eq("session_id", row.session_id);
        if (result.error)
          throw new AccessError(
            "Quedaron accesos pendientes de sincronizar.",
            503,
          );
      }
    }
    cursor = page.data.at(-1)!.session_id;
  }
}
