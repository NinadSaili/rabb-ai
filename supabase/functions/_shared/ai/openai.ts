import { EMBEDDING_DIMENSIONS, type AiProvider, type GenerateInput } from './provider.ts';

/**
 * OpenAI provider. Model names come only from environment variables.
 * Not exercised against the live API in this repository (no key available in the authoring environment).
 */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  constructor(
    private readonly env: { get(name: string): string | undefined },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private required(name: string): string {
    const v = this.env.get(name);
    if (!v) throw new Error(`${name} is not configured`);
    return v;
  }

  private async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await this.fetchFn(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.required('OPENAI_API_KEY')}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`provider_error_${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  async embed(texts: string[]) {
    const data = await this.post('embeddings', { model: this.required('AI_EMBEDDING_MODEL'), input: texts, dimensions: EMBEDDING_DIMENSIONS });
    const items = data.data as { embedding: number[] }[];
    return { vectors: items.map((i) => i.embedding), tokens: Number((data.usage as { total_tokens?: number } | undefined)?.total_tokens ?? 0) };
  }

  async moderate(text: string) {
    const data = await this.post('moderations', { model: this.required('AI_MODERATION_MODEL'), input: text });
    const r = (data.results as { flagged: boolean; categories: Record<string, boolean> }[])[0];
    const c = r?.categories ?? {};
    return { flagged: !!r?.flagged, selfHarm: !!(c['self-harm'] || c['self-harm/intent'] || c['self-harm/instructions']), tokens: 0 };
  }

  async generate(input: GenerateInput) {
    const context = input.context.map((c) => `[${c.label}] ${c.text}`).join('\n');
    const journal = input.journal.length ? `\n<journal_opt_in>\n${input.journal.join('\n---\n')}\n</journal_opt_in>` : '';
    const data = await this.post('chat/completions', {
      model: this.required('AI_CHAT_MODEL'),
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: `<context>\n${context}\n</context>${journal}\n<question>\n${input.question}\n</question>` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'tutor_blocks',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['blocks'],
            properties: {
              blocks: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['type', 'reference', 'text', 'references', 'label'],
                  properties: {
                    type: { type: 'string', enum: ['scripture', 'commentary'] },
                    reference: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['book', 'chapter', 'verse_start', 'verse_end'], properties: { book: { type: 'string' }, chapter: { type: 'integer' }, verse_start: { type: 'integer' }, verse_end: { type: ['integer', 'null'] } } }] },
                    text: { type: 'string' },
                    references: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['book', 'chapter', 'verse_start', 'verse_end'], properties: { book: { type: 'string' }, chapter: { type: 'integer' }, verse_start: { type: 'integer' }, verse_end: { type: ['integer', 'null'] } } } },
                    label: { type: 'string', enum: ['interpretation', 'historical_context', 'explanation'] },
                  },
                },
              },
            },
          },
        },
      },
    });
    const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const content = ((data.choices as { message: { content: string } }[])[0])?.message.content ?? '{}';
    let json: unknown;
    try { json = JSON.parse(content); } catch { json = null; }
    return { json, inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
  }
}
