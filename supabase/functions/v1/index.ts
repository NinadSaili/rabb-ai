import postgres from 'postgres';
import { createApp } from '../_shared/app.ts';
import { makeVerifier } from '../_shared/auth.ts';
import { Db } from '../_shared/db.ts';
import { MockAiProvider } from '../_shared/ai/mock.ts';
import { OpenAiProvider } from '../_shared/ai/openai.ts';
import { createTutorHandler } from '../_shared/ai/pipeline.ts';

const env = { get: (n: string) => Deno.env.get(n) };
const sql = postgres(Deno.env.get('SUPABASE_DB_URL') ?? '', { max: 4, prepare: false, idle_timeout: 20 });
const provider = env.get('AI_PROVIDER') === 'openai' ? new OpenAiProvider(env) : new MockAiProvider(); // MOCK unless configured

const app = createApp({
  db: new Db(sql),
  verifyJwt: makeVerifier(env),
  now: () => new Date(),
  tutor: createTutorHandler({ provider, env }),
  deleteAuthUser: async (userId: string) => {
    const res = await fetch(`${env.get('SUPABASE_URL')}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${env.get('SUPABASE_SERVICE_ROLE_KEY')}`, apikey: env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' },
    });
    if (!res.ok && res.status !== 404) throw new Error(`auth_admin_delete_${res.status}`);
  },
});

Deno.serve(app);
