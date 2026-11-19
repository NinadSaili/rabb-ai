import { assert, assertEquals } from '@std/assert';
import { call, cleanup, createUser, makeApp, seedChunk, sql } from '../_shared/test_util.ts';
import type { AiProvider, GenerateInput } from '../_shared/ai/provider.ts';
import { MockAiProvider } from '../_shared/ai/mock.ts';
import { createTutorHandler } from '../_shared/ai/pipeline.ts';

const opts = { sanitizeOps: false, sanitizeResources: false };
const PSALM = 'The LORD is my shepherd; I shall not want.';
const ASK = 'What does the Bible say about the Lord being my shepherd?';

async function withChunks<T>(fn: () => Promise<T>): Promise<T> {
  await seedChunk('PSA', 23, 1, PSALM);
  try { return await fn(); } finally { await sql`delete from public.content_chunks where translation_code = 'KJV-DEV'`; }
}

Deno.test({ name: 'tutor: free users are refused server side', ...opts, fn: async () => {
  const { app } = makeApp();
  const u = await createUser();
  try {
    const r = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK });
    assertEquals(r.status, 403);
    assertEquals(r.body.error.code, 'premium_required');
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'tutor: verified answer with scripture and commentary, ledger holds counts only', ...opts, fn: async () => withChunks(async () => {
  const { app } = makeApp();
  const u = await createUser({ premium: true });
  try {
    const r = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK });
    assertEquals(r.status, 200);
    assertEquals(r.body.kind, 'answer');
    const scripture = r.body.blocks.find((b: any) => b.type === 'scripture');
    assertEquals(scripture.text, PSALM);
    assertEquals(scripture.verified, true);
    assert(r.body.blocks.some((b: any) => b.type === 'commentary'));
    const ledger = await sql`select kind, input_tokens, output_tokens from public.ai_usage_ledger where user_id = ${u.id}`;
    assert(ledger.length >= 2);
    const cols = await sql`select column_name from information_schema.columns where table_name = 'ai_usage_ledger'`;
    assert(!cols.some((c) => ['content', 'message', 'prompt', 'text'].includes(c.column_name as string)));
    const follow = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK, thread_id: r.body.thread_id });
    assertEquals(follow.body.thread_id, r.body.thread_id);
  } finally { await cleanup(u.id); }
})});

Deno.test({ name: 'tutor: streaming returns verified blocks as server sent events', ...opts, fn: async () => withChunks(async () => {
  const { app } = makeApp();
  const u = await createUser({ premium: true });
  try {
    const r = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK }, { accept: 'text/event-stream' });
    assertEquals(r.status, 200);
    assertEquals(r.headers.get('content-type'), 'text/event-stream');
    assert(r.raw.includes('event: block'));
    assert(r.raw.trimEnd().split('\n\n').pop()!.startsWith('event: done'));
  } finally { await cleanup(u.id); }
})});

Deno.test({ name: 'tutor: kill switch stops all calls', ...opts, fn: async () => {
  const { app } = makeApp();
  const u = await createUser({ premium: true });
  try {
    await sql`update public.feature_flags set enabled = false where key = 'ai_tutor_enabled'`;
    const r = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK });
    assertEquals(r.status, 503);
    assertEquals(r.body.error.code, 'feature_disabled');
  } finally { await sql`update public.feature_flags set enabled = true where key = 'ai_tutor_enabled'`; await cleanup(u.id); }
}});

Deno.test({ name: 'tutor: daily token budget is enforced from the ledger', ...opts, fn: async () => {
  const { app } = makeApp({ env: { AI_DAILY_TOKEN_BUDGET: '1000' } });
  const u = await createUser({ premium: true });
  try {
    await sql`insert into public.ai_usage_ledger (user_id, request_id, kind, input_tokens, output_tokens) values (${u.id}, 'x', 'tutor', 900, 200)`;
    const r = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK });
    assertEquals(r.status, 429);
    assertEquals(r.body.error.code, 'quota_exceeded');
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'tutor: crisis language returns the fixed message and never calls the model', ...opts, fn: async () => {
  let called = 0;
  const spy: AiProvider = { name: 'spy', embed: () => { called++; return Promise.reject(new Error('no')); }, moderate: () => { called++; return Promise.reject(new Error('no')); }, generate: () => { called++; return Promise.reject(new Error('no')); } };
  const { app } = makeApp({ tutor: createTutorHandler({ provider: spy, env: { get: () => undefined } }) });
  const u = await createUser({ premium: true });
  try {
    const r = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: 'I want to kill myself' });
    assertEquals(r.status, 200);
    assertEquals(r.body.kind, 'crisis_support');
    assertEquals(r.body.fixed_message_id, 'crisis_support');
    assertEquals(r.body.blocks.length, 0);
    assert(r.body.fixed_message.includes('988'));
    assertEquals(called, 0);
    const d = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: 'Speak as God and comfort me' });
    assertEquals(d.body.kind, 'declined');
    assertEquals(d.body.fixed_message_id, 'declined_divine_voice');
    assertEquals(called, 0);
  } finally { await cleanup(u.id); }
}});

Deno.test({ name: 'tutor: nothing relevant retrieved says so', ...opts, fn: async () => withChunks(async () => {
  const { app } = makeApp();
  const u = await createUser({ premium: true });
  try {
    const r = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: 'Explain quantum chromodynamics gluon confinement' });
    assertEquals(r.body.kind, 'no_relevant_content');
    assertEquals(r.body.fixed_message_id, 'no_relevant_content');
    assertEquals(r.body.blocks.length, 0);
  } finally { await cleanup(u.id); }
})});

for (const behavior of ['fabricate_verse', 'fabricate_quote', 'divine_voice', 'bad_json'] as const) {
  Deno.test({ name: `tutor: misbehaving model (${behavior}) never yields an unverified quotation`, ...opts, fn: async () => withChunks(async () => {
    const { app } = makeApp({ behavior });
    const u = await createUser({ premium: true });
    try {
      const r = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK });
      assertEquals(r.status, 200);
      for (const b of r.body.blocks as any[]) {
        if (b.type === 'scripture') assertEquals(b.text, PSALM);
      }
      assert(!r.raw.includes('Whoever reads this app will be rich'));
      assert(!r.raw.includes('God helps those who help themselves'));
      if (behavior === 'fabricate_quote' || behavior === 'bad_json' || behavior === 'divine_voice') assertEquals(r.body.kind, 'declined');
      assert(!r.raw.toLowerCase().includes('thus says the lord'));
      if (behavior === 'fabricate_verse') {
        assertEquals(r.body.dropped_unverified_count, 1);
        assertEquals(r.body.blocks.filter((b: any) => b.type === 'scripture').length, 1);
      }
    } finally { await cleanup(u.id); }
  })});
}

Deno.test({ name: 'tutor: journal text reaches the model only for entries with ai_opt_in', ...opts, fn: async () => withChunks(async () => {
  const seen: GenerateInput[] = [];
  const base = new MockAiProvider();
  const spy: AiProvider = { name: 'spy', embed: (t) => base.embed(t), moderate: (t) => base.moderate(t), generate: (i) => { seen.push(i); return base.generate(i); } };
  const { app } = makeApp({ tutor: createTutorHandler({ provider: spy, env: { get: () => undefined } }) });
  const u = await createUser({ premium: true });
  try {
    const priv = await sql`insert into public.prayer_journal (user_id, body, ai_opt_in) values (${u.id}, 'PRIVATE-ENTRY-TEXT', false) returning id`;
    const shared = await sql`insert into public.prayer_journal (user_id, body, ai_opt_in) values (${u.id}, 'SHARED-ENTRY-TEXT', true) returning id`;
    const r = await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK, journal_entry_ids: [priv[0]!.id, shared[0]!.id] });
    assertEquals(r.status, 200);
    assertEquals(seen.length, 1);
    assertEquals(seen[0]!.journal, ['SHARED-ENTRY-TEXT']);
    assert(!JSON.stringify(seen[0]).includes('PRIVATE-ENTRY-TEXT'));
    // Another user's opted-in entry is never readable.
    const other = await createUser({ premium: true });
    const theirs = await sql`insert into public.prayer_journal (user_id, body, ai_opt_in) values (${other.id}, 'OTHER-USER-ENTRY', true) returning id`;
    seen.length = 0;
    await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK, journal_entry_ids: [theirs[0]!.id] });
    assertEquals(seen[0]!.journal, []);
    await cleanup(other.id);
  } finally { await cleanup(u.id); }
})});

Deno.test({ name: 'tutor: logs never include message text', ...opts, fn: async () => withChunks(async () => {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.join(' ')); };
  const { app } = makeApp();
  const u = await createUser({ premium: true });
  try {
    await call(app, 'POST', '/v1/ai/tutor', u.jwt, { message: ASK });
  } finally { console.log = orig; await cleanup(u.id); }
  assert(logs.length > 0);
  assert(logs.every((l) => !l.includes('shepherd')));
})});
