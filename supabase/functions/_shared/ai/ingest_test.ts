import { assert, assertEquals } from '@std/assert';
import { chunkText, ingest } from './ingest.ts';
import { MockAiProvider } from './mock.ts';
import { sql } from '../test_util.ts';

Deno.test('chunkText respects paragraph boundaries and the size limit', () => {
  const para = (n: number) => `Paragraph ${n}. ` + 'word '.repeat(60);
  const chunks = chunkText([para(1), para(2), para(3)].join('\n\n'), 400);
  assert(chunks.length >= 2);
  for (const c of chunks) assert(c.length <= 400 + 1, `chunk too long: ${c.length}`);
  assertEquals(chunkText(''), []);
  assertEquals(chunkText('short'), ['short']);
});

Deno.test({ name: 'ingest: embeds DEV fixtures only when allowed, replaces chunks idempotently, excludes unverified translations', sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const provider = new MockAiProvider();
  try {
    const none = await ingest(sql, provider);
    assertEquals(none.scripture, 0); // DEV ONLY fixtures are unverified: never ingested by default
    const dev = await ingest(sql, provider, { allowDev: true });
    assert(dev.scripture >= 7);
    const again = await ingest(sql, provider, { allowDev: true });
    assertEquals(again.scripture, dev.scripture);
    const rows = await sql`select count(*)::int as n from public.content_chunks where source_type = 'scripture'`;
    assertEquals(rows[0]!.n, dev.scripture);
    const journal = await sql`select count(*)::int as n from public.content_chunks where content ilike '%private%'`;
    assertEquals(journal[0]!.n, 0);
  } finally {
    await sql`delete from public.content_chunks where source_type in ('scripture', 'lesson')`;
  }
}});
