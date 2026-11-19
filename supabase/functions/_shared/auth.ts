import { createRemoteJWKSet, jwtVerify } from 'jose';

export type VerifyJwt = (token: string) => Promise<{ userId: string } | null>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verifies a Supabase access token. Legacy projects sign with a shared secret (HS256, SUPABASE_JWT_SECRET).
 * Newer projects publish asymmetric keys at the project JWKS endpoint. Anonymous users carry role "authenticated" too.
 */
export function makeVerifier(env: { get(name: string): string | undefined }): VerifyJwt {
  const secret = env.get('SUPABASE_JWT_SECRET');
  const url = env.get('SUPABASE_URL');
  const key = secret ? new TextEncoder().encode(secret) : null;
  const jwks = !key && url ? createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`)) : null;
  return async (token: string) => {
    try {
      const { payload } = key
        ? await jwtVerify(token, key, { algorithms: ['HS256'] })
        : await jwtVerify(token, jwks as ReturnType<typeof createRemoteJWKSet>);
      if (payload.role !== 'authenticated') return null;
      if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) return null;
      return { userId: payload.sub };
    } catch {
      return null;
    }
  };
}
