import { ensureSession, isAnonymous, linkEmailPassword, signInEmailPassword, type AuthLike } from './auth';

function fake(over: { session?: boolean; anon?: boolean; anonError?: boolean; updateError?: boolean } = {}) {
  const calls: string[] = [];
  let session = over.session ? { access_token: 't', user: { id: 'u1', is_anonymous: over.anon ?? true } } : null;
  const client: AuthLike = {
    auth: {
      getSession: async () => ({ data: { session } }),
      signInAnonymously: async () => {
        calls.push('anon');
        if (over.anonError) return { data: { session: null }, error: { message: 'disabled' } };
        session = { access_token: 't', user: { id: 'u1', is_anonymous: true } };
        return { data: { session }, error: null };
      },
      signInWithPassword: async () => { calls.push('password'); return { error: null }; },
      updateUser: async () => { calls.push('update'); return { error: over.updateError ? { message: 'email taken' } : null }; },
      signOut: async () => ({ error: null }),
    },
  };
  return { client, calls };
}

describe('auth session', () => {
  it('starts an anonymous session when none exists, exactly once', async () => {
    const f = fake();
    expect(await ensureSession(f.client)).toEqual({ ok: true });
    expect(await ensureSession(f.client)).toEqual({ ok: true });
    expect(f.calls).toEqual(['anon']);
    expect(await isAnonymous(f.client)).toBe(true);
  });
  it('reports failure when anonymous sign in is disabled', async () => {
    expect(await ensureSession(fake({ anonError: true }).client)).toEqual({ ok: false, message: 'disabled' });
  });
  it('links email and password to the existing anonymous user (updateUser keeps the user id)', async () => {
    const f = fake({ session: true });
    expect(await linkEmailPassword(f.client, 'a@b.co', 'longenough')).toEqual({ ok: true });
    expect(f.calls).toEqual(['update']);
  });
  it('validates input and requires a session before linking', async () => {
    const f = fake({ session: true });
    expect(await linkEmailPassword(f.client, 'bad', 'longenough')).toMatchObject({ ok: false });
    expect(await linkEmailPassword(f.client, 'a@b.co', 'short')).toMatchObject({ ok: false });
    expect(f.calls).toEqual([]);
    expect(await linkEmailPassword(fake().client, 'a@b.co', 'longenough')).toEqual({ ok: false, message: 'no_session' });
  });
  it('surfaces provider errors such as an email that is already taken', async () => {
    expect(await linkEmailPassword(fake({ session: true, updateError: true }).client, 'a@b.co', 'longenough')).toEqual({ ok: false, message: 'email taken' });
  });
  it('signs in an existing account', async () => {
    const f = fake();
    expect(await signInEmailPassword(f.client, 'a@b.co', 'longenough')).toEqual({ ok: true });
    expect(f.calls).toEqual(['password']);
  });
});
