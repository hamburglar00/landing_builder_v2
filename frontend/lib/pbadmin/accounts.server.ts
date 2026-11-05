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

export async function reserveAccount(db: SupabaseClient, identity: Identity) {
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
export async function ensureManagedAuth(
  db: SupabaseClient,
  id: string,
  email: string,
  ownerId: number,
  kind: string,
) {
  const lookup = await db.auth.admin.getUserById(id);
  let user = lookup.data.user;
  if (!user) {
    if (lookup.error && lookup.error.status !== 404)
      throw new AccessError(
        "No se pudo verificar el alta. Volvé a intentar.",
        503,
      );
    const created = await db.auth.admin.createUser({
      id,
      email,
      email_confirm: true,
      password: randomBytes(48).toString("base64url"),
      app_metadata: {
        pbadmin_managed: true,
        pbadmin_owner_id: ownerId,
        pbadmin_kind: kind,
        panelbot_admin_created: true,
        panelbot_role: "client",
      },
    });
    user = created.data.user;
    if (!user) user = (await db.auth.admin.getUserById(id)).data.user;
  }
  if (
    !user ||
    user.id !== id ||
    user.email !== email ||
    user.app_metadata.pbadmin_owner_id !== ownerId ||
    user.app_metadata.pbadmin_kind !== kind
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
