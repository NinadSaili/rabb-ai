import type { Sql } from 'postgres';
import { EMBEDDING_DIMENSIONS, type AiProvider } from './provider.ts';

export interface Chunk {
  source_type: 'scripture' | 'lesson';
  source_id: string | null;
  translation_code: string | null;
  book: string | null;
  chapter: number | null;
  verse_start: number | null;
  verse_end: number | null;
  content: string;
}

const MAX_CHARS = 800;

/** Splits lesson text on paragraph boundaries into chunks of at most 800 characters. */
export function chunkText(text: string, max = MAX_CHARS): string[] {
  const out: string[] = [];
  let cur = '';
  for (const para of text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    for (const piece of para.length > max ? para.match(new RegExp(`.{1,${max}}(\\s|$)`, 'g')) ?? [para] : [para]) {
      const p = piece.trim();
      if (cur && cur.length + p.length + 2 > max) { out.push(cur); cur = ''; }
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Embeds approved content into pgvector. Idempotent: existing chunks of the same source are replaced.
 * Scripture: translations with verified AI use (release gate), or DEV ONLY fixtures when allowDev is set.
 * Lessons: published lessons only. Prayer journals are never ingested.
 */
export async function ingest(sql: Sql, provider: AiProvider, opts: { allowDev?: boolean } = {}): Promise<{ scripture: number; lessons: number }> {
  const chunks: Chunk[] = [];
  const verses = await sql`
    select t.code, c.book, c.chapter, c.verse, c.text
    from public.scripture_translations t join public.scripture_content c on c.translation_id = t.id
    where (t.ai_use_verified and t.license_verified_at is not null) or (${opts.allowDev ?? false} and t.is_dev_only)
    order by t.code, c.book, c.chapter, c.verse`;
  for (const v of verses) {
    chunks.push({ source_type: 'scripture', source_id: null, translation_code: v.code as string, book: v.book as string, chapter: Number(v.chapter), verse_start: Number(v.verse), verse_end: null, content: v.text as string });
  }
  const lessons = await sql`select id, body from public.learning_lessons where status = 'published'`;
  for (const l of lessons) {
    for (const piece of chunkText(l.body as string)) {
      chunks.push({ source_type: 'lesson', source_id: l.id as string, translation_code: null, book: null, chapter: null, verse_start: null, verse_end: null, content: piece });
    }
  }

  await sql`delete from public.content_chunks where source_type in ('scripture', 'lesson')`;
  for (let i = 0; i < chunks.length; i += 64) {
    const batch = chunks.slice(i, i + 64);
    const { vectors } = await provider.embed(batch.map((c) => c.content));
    for (let j = 0; j < batch.length; j++) {
      const c = batch[j] as Chunk;
      const v = vectors[j] as number[];
      if (v.length !== EMBEDDING_DIMENSIONS) throw new Error(`embedding dimension ${v.length} does not match ${EMBEDDING_DIMENSIONS}`);
      await sql`
        insert into public.content_chunks (source_type, source_id, translation_code, book, chapter, verse_start, verse_end, content, embedding)
        values (${c.source_type}, ${c.source_id}, ${c.translation_code}, ${c.book}, ${c.chapter}, ${c.verse_start}, ${c.verse_end}, ${c.content}, ${JSON.stringify(v)}::extensions.vector(1536))`;
    }
  }
  return { scripture: chunks.filter((c) => c.source_type === 'scripture').length, lessons: chunks.filter((c) => c.source_type === 'lesson').length };
}
