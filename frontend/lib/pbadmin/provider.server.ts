import { createClient } from "@supabase/supabase-js";
import { initializeClientDefaults } from "../../../supabase/functions/_shared/initialize-client";
import { AccessError, broker, type Identity } from "./protocol.server";
import {
  assertLinkedProfile,
  ensureManagedAuth,
  issueSession,
  reserveAccount,
  verifyNativeAccount,
} from "./accounts.server";

export function adminDb() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!key)
    throw new AccessError(
      "El acceso con PBAdmin todavía no está configurado.",
      503,
    );
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function sessionClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function provision(
  identity: Identity,
  code: string,
  connectOnly = false,
) {
  if (identity.intent === "open" && !identity.accountId)
    throw new AccessError(
      "Primero vinculá o creá tu cuenta desde Extensiones en PBAdmin.",
    );
  const db = adminDb(),
    account = await reserveAccount(db, identity);
  const uid = account.account_id;
  if (identity.intent === "open") await assertLinkedProfile(db, uid, "client");
  if (account.legacy) {
    const user = (await db.auth.admin.getUserById(uid)).data.user;
    const profile = await db
      .from("profiles")
      .select("role,nombre")
      .eq("id", uid)
      .single();
    if (
      !user ||
      (identity.accountEmail && user.email !== identity.accountEmail) ||
      profile.error ||
      profile.data.role !== "client"
    )
      throw new AccessError(
        "El constructor no coincide con la cuenta aprobada.",
      );
  } else {
    let defaultsAdminId: string | null = null;
    const email = `pbadmin-owner-${identity.ownerId}@accounts.pbadmin.invalid`;
    if (!account.ready) {
      const configured = process.env.PBADMIN_DEFAULTS_ADMIN_ID;
      let query = db.from("profiles").select("id").eq("role", "admin");
      if (configured) query = query.eq("id", configured);
      const defaultsAdmin = await query.limit(2);
      if (defaultsAdmin.error || defaultsAdmin.data.length !== 1)
        throw new AccessError(
          "Falta elegir la configuración por defecto del constructor.",
          503,
        );
      defaultsAdminId = defaultsAdmin.data[0].id;
      // Match create-client: the Auth insert trigger sees an approval before
      // GoTrue finishes applying app_metadata. Retry preserves the reserved UUID.
      const approval = await db.from("auth_signup_approvals").upsert(
        {
          email,
          user_id: uid,
          requested_by: defaultsAdminId,
          role: "client",
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 300_000).toISOString(),
        },
        { onConflict: "email" },
      );
      if (approval.error)
        throw new AccessError(
          "No se pudo preparar el alta del constructor.",
          503,
        );
    }
    await ensureManagedAuth(db, uid, email, identity.ownerId, "builder");
    const profile = await db
      .from("profiles")
      .select("role,nombre")
      .eq("id", uid)
      .single();
    if (profile.error || profile.data.role !== "client")
      throw new AccessError(
        "No se pudo verificar el perfil del constructor.",
        503,
      );
    if (!profile.data.nombre) {
      const result = await db
        .from("profiles")
        .update({ nombre: `pbadmin${identity.ownerId}` })
        .eq("id", uid)
        .is("nombre", null);
      if (result.error)
        throw new AccessError(
          "No se pudo inicializar el nombre del constructor.",
          503,
        );
    }
    if (!account.ready) {
      await initializeClientDefaults(db, uid, defaultsAdminId!);
      const cleanup = await db
        .from("auth_signup_approvals")
        .delete()
        .eq("email", email)
        .eq("user_id", uid);
      if (cleanup.error)
        throw new AccessError("El alta quedó pendiente de finalizar.", 503);
    }
  }
  const profile = await db
    .from("profiles")
    .select("nombre")
    .eq("id", uid)
    .single();
  if (profile.error || !/^[a-z0-9]+$/i.test(profile.data.nombre ?? ""))
    throw new AccessError(
      "El constructor no tiene una URL de Tracking válida.",
    );
  const post = new URL(
    "/functions/v1/conversions",
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
  );
  post.searchParams.set("name", profile.data.nombre);
  await broker("builder", "register", {
    code,
    accountId: uid,
    userId: uid,
    postUrl: post.toString(),
  });
  const ready = await db
    .from("pbadmin_accounts")
    .update({ ready: true })
    .eq("owner_id", identity.ownerId)
    .eq("account_id", uid)
    .is("disconnected_at", null).select("account_id").single();
  if (ready.error)
    throw new AccessError("El vínculo quedó pendiente. Volvé a intentar.", 503);
  return {
    db,
    uid,
    session: connectOnly
      ? null
      : await issueSession(db, sessionClient(), identity, uid),
  };
}

export async function connect(
  identity: Identity,
  code: string,
  input: { email?: unknown; password?: unknown },
) {
  if (identity.intent === "link") {
    const user = await verifyNativeAccount(
      sessionClient(),
      input.email,
      input.password,
    );
    const profile = await adminDb()
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile.error || profile.data.role !== "client")
      throw new AccessError("Vinculá una cuenta de cliente del constructor.");
    if (identity.accountId && identity.accountId !== user.id)
      throw new AccessError(
        "Esta administración ya tiene otro constructor vinculado.",
      );
    identity = { ...identity, accountId: user.id, accountEmail: user.email! };
  } else if (identity.intent !== "create")
    throw new AccessError("Elegí cómo vincular tu cuenta.", 400);
  await provision(identity, code, true);
  return { status: "connected" };
}
