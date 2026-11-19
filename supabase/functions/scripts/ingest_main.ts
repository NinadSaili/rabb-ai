import postgres from 'postgres';
import { ingest } from '../_shared/ai/ingest.ts';
import { MockAiProvider } from '../_shared/ai/mock.ts';
import { OpenAiProvider } from '../_shared/ai/openai.ts';

const env = { get: (n: string) => Deno.env.get(n) };
const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL is required');
const provider = env.get('AI_PROVIDER') === 'openai' ? new OpenAiProvider(env) : new MockAiProvider();
const sql = postgres(url, { max: 1, prepare: false });
const result = await ingest(sql, provider, { allowDev: Deno.env.get('INGEST_ALLOW_DEV') === '1' });
console.log(JSON.stringify({ provider: provider.name, ...result }));
await sql.end();
