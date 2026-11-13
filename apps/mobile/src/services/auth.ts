/** Minimal slice of the supabase-js auth client, so the session logic is testable without a server. */
export interface AuthLike {
  auth: {
    getSession(): Promise<{ data: { session: { access_token: string; user: { id: string; is_anonymous?: boolean; email?: string | null } } | null } }>;
    signInAnonymously(): Promise<{ data: { session: { access_token: string } | null }; error: { message: string } | null }>;
    signInWithPassword(c: { email: string; password: string }): Promise<{ error: { message: string } | null }>;
    updateUser(a: { email?: string; password?: string }): Promise<{ error: { message: string } | null }>;
    signOut(): Promise<{ error: { message: string } | null }>;
  };
}

export type AuthResult = { ok: true } | { ok: false; message: string };

/**
 * New users start with an anonymous session so they reach their first ritual before creating an account.
 * Anonymous users get a normal authenticated JWT, and linking keeps the same user id (no data moves).
 */
export async function ensureSession(client: AuthLike): Promise<AuthResult> {
  const { data } = await client.auth.getSession();
  if (data.session) return { ok: true };
  const r = await client.auth.signInAnonymously();
  return r.error || !r.data.session ? { ok: false, message: r.error?.message ?? 'anonymous sign in failed' } : { ok: true };
}

/** Converts the anonymous user to an email account while keeping the same user id. */
export async function linkEmailPassword(client: AuthLike, email: string, password: string): Promise<AuthResult> {
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return { ok: false, message: 'invalid_credentials_format' };
  const { data } = await client.auth.getSession();
  if (!data.session) return { ok: false, message: 'no_session' };
  const r = await client.auth.updateUser({ email, password });
  return r.error ? { ok: false, message: r.error.message } : { ok: true };
}

export async function signInEmailPassword(client: AuthLike, email: string, password: string): Promise<AuthResult> {
  const r = await client.auth.signInWithPassword({ email, password });
  return r.error ? { ok: false, message: r.error.message } : { ok: true };
}

export async function isAnonymous(client: AuthLike): Promise<boolean> {
  const { data } = await client.auth.getSession();
  return !!data.session?.user.is_anonymous;
}
