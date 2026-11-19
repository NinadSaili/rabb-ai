import postgres from 'postgres';
import { SignJWT } from 'jose';
import { createApp, type Deps } from './app.ts';
import { makeVerifier } from './auth.ts';
import { Db } from './db.ts';
import { MockAiProvider, mockEmbed, type MockBehavior } from './ai/mock.ts';
import { createTutorHandler } from './ai/pipeline.ts';

export const JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
const DB_URL = Deno.env.get('RABB_TEST_DB_URL') ?? 'postgresql://postgres:postgres@127.0.0.1:5432/rabb_local';

export const sql = postgres(DB_URL, { max: 4, prepare: false, onnotice: () => {} });
export const db = new Db(sql);

// Tests run against the DEV ONLY fixtures, which are served only when this flag is on (never in production).
await sql`update public.feature_flags set enabled = true where key = 'allow_dev_content'`;

export async function token(userId: string, role = 'authenticated'): Promise<string> {
  return await new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(JWT_SECRET));
}

export async function createUser(opts: { timezone?: string; premium?: boolean; schedule?: boolean; timer?: number | null } = {}) {
  const id = crypto.randomUUID();
  await sql`insert into auth.users (id, email) values (${id}, ${id + '@example.test'})`;
  if (opts.timezone) await sql`update public.profiles set timezone = ${opts.timezone} where id = ${id}`;
  let scheduleId: string | null = null;
  if (opts.schedule !== false) {
    const rows = await sql`
      insert into public.ritual_schedules (user_id, name, kind, weekdays, start_minute, end_minute, timer_seconds)
      values (${id}, 'Morning', 'morning', array[0,1,2,3,4,5,6]::smallint[], 300, 720, ${opts.timer === undefined ? null : opts.timer}) returning id`;
    scheduleId = (rows[0] as { id: string }).id;
  }
  if (opts.premium) {
    await sql`insert into public.subscriptions (user_id, status, store, expires_at) values (${id}, 'active', 'app_store', now() + interval '30 days')`;
  }
  return { id, scheduleId, jwt: await token(id) };
}

export function makeApp(over: Partial<Deps> & { behavior?: MockBehavior; env?: Record<string, string> } = {}) {
  const provider = new MockAiProvider(over.behavior ?? 'faithful');
  const env = { get: (n: string) => over.env?.[n] ?? (n === 'SUPABASE_JWT_SECRET' ? JWT_SECRET : undefined) };
  const deps: Deps = {
    db,
    verifyJwt: makeVerifier(env),
    now: () => new Date(),
    tutor: createTutorHandler({ provider, env }),
    deleteAuthUser: async (userId) => { await sql`delete from auth.users where id = ${userId}`; },
    ...over,
  };
  const app = createApp(deps);
  return { app, provider };
}

export async function call(app: (r: Request) => Promise<Response>, method: string, path: string, jwt: string | null, body?: unknown, headers: Record<string, string> = {}) {
  const res = await app(new Request(`http://localhost/functions/v1${path}`, {
    method,
    headers: { ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed as Record<string, any>, headers: res.headers, raw: text };
}

export const uuid = () => crypto.randomUUID();

/** Inserts content chunks whose embeddings come from the mock provider. */
export async function seedChunk(book: string, chapter: number, verse: number, text: string) {
  const vec = JSON.stringify(mockEmbed(text));
  await sql`insert into public.content_chunks (source_type, translation_code, book, chapter, verse_start, content, embedding)
            values ('scripture', 'KJV-DEV', ${book}, ${chapter}, ${verse}, ${text}, ${vec}::extensions.vector(1536))`;
}

export async function cleanup(...userIds: string[]) {
  for (const id of userIds) await sql`delete from auth.users where id = ${id}`;
}
