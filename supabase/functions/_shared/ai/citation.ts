import type { ScriptureReference, TutorBlock } from '@rabb/contracts';
import { speaksAsGodOrPredicts } from './crisis.ts';

/** Lowercase, remove punctuation and curly quotes, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MIN_QUOTE_WORDS = 4;

export interface StoredPassage {
  translation: string;
  /** Verse texts in order. */
  verses: string[];
}

export type VerseLookup = (ref: ScriptureReference) => Promise<StoredPassage | null>;

export interface RawBlock {
  type: 'scripture' | 'commentary';
  reference?: ScriptureReference;
  /** Text the model supplied. For scripture blocks it is only compared, never shown. */
  text?: string;
  references?: ScriptureReference[];
  label?: 'interpretation' | 'historical_context' | 'explanation';
}

export interface VerificationResult {
  blocks: TutorBlock[];
  dropped: number;
  repaired: number;
}

function quotedSpans(text: string): string[] {
  const spans: string[] = [];
  const re = /["“]([^"”]{1,500})["”]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[1] as string;
    if (normalize(s).split(' ').length >= MIN_QUOTE_WORDS) spans.push(s);
  }
  return spans;
}

/**
 * Verifies model output against stored text. Rules:
 * - A scripture block must point to a reference that exists. The stored text is always the text returned.
 *   If the model's text differs from stored text the block is repaired (replaced with stored text) and counted.
 * - A scripture block with a reference that does not exist is dropped.
 * - A commentary block is dropped when it quotes four or more words that appear in no stored passage
 *   of its own references or the retrieved passages.
 * - A commentary block that speaks as God or predicts a person's future is dropped.
 * - Reference lists keep only references that exist.
 */
export async function verifyBlocks(raw: RawBlock[], lookup: VerseLookup, retrievedTexts: string[]): Promise<VerificationResult> {
  const out: TutorBlock[] = [];
  let dropped = 0;
  let repaired = 0;
  const corpus = retrievedTexts.map(normalize);

  for (const b of raw) {
    if (b.type === 'scripture') {
      if (!b.reference) { dropped++; continue; }
      const stored = await lookup(b.reference);
      if (!stored || stored.verses.length === 0) { dropped++; continue; }
      const storedText = stored.verses.join(' ');
      if (b.text !== undefined && b.text.trim() !== '') {
        const given = normalize(b.text);
        const full = normalize(storedText);
        const isExact = given === full || (given.split(' ').length >= MIN_QUOTE_WORDS && full.includes(given));
        if (!isExact) repaired++;
      }
      out.push({ type: 'scripture', reference: b.reference, translation: stored.translation, text: storedText, verified: true });
      continue;
    }

    const refs: ScriptureReference[] = [];
    const ownCorpus = [...corpus];
    for (const r of b.references ?? []) {
      const stored = await lookup(r);
      if (stored && stored.verses.length > 0) {
        refs.push(r);
        ownCorpus.push(normalize(stored.verses.join(' ')));
      }
    }
    const text = (b.text ?? '').trim();
    if (text === '' || speaksAsGodOrPredicts(text)) { dropped++; continue; }
    const badQuote = quotedSpans(text).some((q) => {
      const n = normalize(q);
      return !ownCorpus.some((c) => c.includes(n));
    });
    if (badQuote) { dropped++; continue; }
    out.push({ type: 'commentary', text, references: refs, label: b.label ?? 'explanation' });
  }
  return { blocks: out, dropped, repaired };
}
