import { EMBEDDING_DIMENSIONS, type AiProvider, type GenerateInput } from './provider.ts';

/**
 * MOCK provider. Used only when no AI provider credentials are configured (AI_PROVIDER=mock) and in tests.
 * Deterministic: hashed bag of words embeddings, keyword moderation, and an answer built from the retrieved context.
 */
export type MockBehavior = 'faithful' | 'fabricate_verse' | 'fabricate_quote' | 'bad_json' | 'divine_voice';

function hash(word: string): number {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'is', 'it', 'that', 'for', 'on', 'with', 'what', 'does', 'say', 'about', 'how', 'why', 'me', 'my']);

export function mockEmbed(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const w of text.toLowerCase().split(/[^a-z0-9']+/).filter((x) => x && !STOP.has(x))) {
    v[hash(w) % EMBEDDING_DIMENSIONS]! += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  constructor(public behavior: MockBehavior = 'faithful') {}

  embed(texts: string[]) {
    return Promise.resolve({ vectors: texts.map(mockEmbed), tokens: texts.reduce((s, t) => s + Math.ceil(t.length / 4), 0) });
  }

  moderate(text: string) {
    const selfHarm = /suicid|kill myself|end my life/i.test(text);
    const flagged = selfHarm || /\b(build a bomb|make a weapon)\b/i.test(text);
    return Promise.resolve({ flagged, selfHarm, tokens: Math.ceil(text.length / 4) });
  }

  generate(input: GenerateInput) {
    const inputTokens = Math.ceil((input.system.length + input.question.length + input.context.reduce((s, c) => s + c.text.length, 0)) / 4);
    const first = input.context[0];
    const ref = (first?.label ?? '').match(/^([1-3A-Z]{3}) (\d+):(\d+)(?:-(\d+))?/);
    let json: unknown;
    switch (this.behavior) {
      case 'bad_json':
        json = 'not an object';
        break;
      case 'fabricate_verse':
        json = { blocks: [
          { type: 'scripture', reference: { book: 'JHN', chapter: 99, verse_start: 99 }, text: 'Whoever reads this app will be rich.' },
          ...(ref ? [{ type: 'scripture', reference: { book: ref[1], chapter: Number(ref[2]), verse_start: Number(ref[3]) }, text: 'A completely different wording that is not the verse.' }] : []),
        ] };
        break;
      case 'fabricate_quote':
        json = { blocks: [{ type: 'commentary', label: 'explanation', references: [], text: 'The Bible says "God helps those who help themselves and always will" in plain words.' }] };
        break;
      case 'divine_voice':
        json = { blocks: [{ type: 'commentary', label: 'explanation', references: [], text: 'Thus says the Lord: I will make you rich next year.' }] };
        break;
      default:
        json = !ref || !first ? { blocks: [] } : /predestin|free will|baptiz|eucharist|annihilat|tongues|literal days/i.test(input.question)
          ? { blocks: [{ type: 'commentary', label: 'interpretation', references: [], text: 'Christians have held several historic positions on this question. These are interpretations, and the passages offered here do not settle it by themselves.' }] }
          : { blocks: [
          { type: 'scripture', reference: { book: ref[1], chapter: Number(ref[2]), verse_start: Number(ref[3]), ...(ref[4] ? { verse_end: Number(ref[4]) } : {}) }, text: first.text },
          { type: 'commentary', label: 'explanation', references: [{ book: ref[1], chapter: Number(ref[2]), verse_start: Number(ref[3]) }], text: 'This passage is the main source for your question. Read it in its chapter for context.' },
        ] };
    }
    return Promise.resolve({ json, inputTokens, outputTokens: 120 });
  }
}
