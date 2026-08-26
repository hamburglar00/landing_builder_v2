type SupabaseAuthError = {
  message?: string;
};

type SupabaseRealtimeSession = {
  access_token?: string | null;
  expires_at?: number | null;
  user?: {
    id?: string | null;
  } | null;
};

export type SupabaseRealtimeAuthClient = {
  auth: {
    getSession: () => Promise<{
      data: { session: SupabaseRealtimeSession | null };
      error: SupabaseAuthError | null;
    }>;
    refreshSession: () => Promise<{
      data: { session: SupabaseRealtimeSession | null };
      error: SupabaseAuthError | null;
    }>;
  };
  realtime: {
    setAuth: (token: string) => void;
  };
};

export type RealtimeAuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

const TOKEN_REFRESH_MARGIN_SECONDS = 60;

function shouldRefreshRealtimeSession(
  session: SupabaseRealtimeSession | null,
  nowInSeconds = Math.floor(Date.now() / 1000),
) {
  if (!session?.access_token) return true;
  if (!session.expires_at) return false;
  return session.expires_at - nowInSeconds <= TOKEN_REFRESH_MARGIN_SECONDS;
}

export async function ensureRealtimeAuth(
  supabase: SupabaseRealtimeAuthClient,
): Promise<RealtimeAuthResult> {
  let {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (shouldRefreshRealtimeSession(session)) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
    error = refreshed.error;
  }

  if (error || !session?.access_token) {
    return {
      ok: false,
      error:
        error?.message ??
        "Sesion de Supabase no disponible para suscribirse a Realtime.",
    };
  }

  supabase.realtime.setAuth(session.access_token);

  return {
    ok: true,
    userId: session.user?.id || "session",
  };
}

