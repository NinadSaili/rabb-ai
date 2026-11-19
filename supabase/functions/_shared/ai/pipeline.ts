import { tutorRequest, tutorResponse, type TutorBlock, type TutorResponse } from '@rabb/contracts';
import { z } from 'zod';
import type { Ctx } from '../app.ts';
import { ApiException, json, parseWith, readJson } from '../http.ts';
import { verifyBlocks, type RawBlock, type VerseLookup } from './citation.ts';
import { detectCrisis, detectDeclined, FIXED_MESSAGES, type FixedMessageId } from './crisis.ts';
import { SYSTEM_PROMPT, type AiProvider } from './provider.ts';

export type TutorHandler = (ctx: Ctx) => Promise<unknown | Response>;

const refSchema = z.object({
  book: z.string().regex(/^[1-3A-Z]{3}$/),
  chapter: z.number().int().min(1).max(150),
  verse_start: z.number().int().min(1).max(176),
  verse_end: z.number().int().min(1).max(176).nullish().transform((v) => v ?? undefined),
});
const rawBlock = z.object({
  type: z.enum(['scripture', 'commentary']),
  reference: refSchema.nullish().transform((v) => v ?? undefined),
  text: z.string().max(4000).optional(),
  references: z.array(refSchema).max(8).optional(),
  label: z.enum(['interpretation', 'historical_context', 'explanation']).optional(),
});
const rawOutput = z.object({ blocks: z.array(rawBlock).max(12) });

export interface TutorConfig {
  provider: AiProvider;
  env: { get(name: string): string | undefined };
}

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

function respond(ctx: Ctx, body: TutorResponse, stream: boolean): Response | TutorResponse {
  const parsed = tutorResponse.parse(body);
  if (!stream) return parsed;
  const encoder = new TextEncoder();
  const { blocks, ...rest } = parsed;
  const events = [...blocks.map((b: TutorBlock) => `event: block\ndata: ${JSON.stringify(b)}\n\n`), `event: done\ndata: ${JSON.stringify(rest)}\n\n`];
  return new Response(new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(e));
      controller.close();
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-request-id': ctx.requestId, 'access-control-allow-origin': '*' } });
}

/**
 * Pipeline: kill switch, entitlement, input validation, quota, crisis check, divine voice and prophecy check, moderation,
 * retrieval, generation, citation verification, ledger, response. Streaming sends verified blocks only.
 */
export function createTutorHandler(cfg: TutorConfig): TutorHandler {
  return async (ctx: Ctx) => {
    const { db } = ctx.deps;
    const stream = (ctx.req.headers.get('accept') ?? '').includes('text/event-stream');

    if (!(await db.flagEnabled('ai_tutor_enabled'))) throw new ApiException('feature_disabled', 'the tutor is temporarily unavailable');
    if (!(await db.isPremium(ctx.userId))) throw new ApiException('premium_required', 'Rabb.ai Premium is required');
    const body = parseWith(tutorRequest, await readJson(ctx.req));

    const today = ctx.deps.now().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;
    const daily = num(cfg.env.get('AI_DAILY_TOKEN_BUDGET'), 20_000);
    const monthly = num(cfg.env.get('AI_MONTHLY_TOKEN_BUDGET'), 300_000);
    if ((await db.tokensSince(ctx.userId, today)) >= daily || (await db.tokensSince(ctx.userId, monthStart)) >= monthly) {
      throw new ApiException('quota_exceeded', 'token budget reached, try again later');
    }

    const fixed = async (id: FixedMessageId, kind: TutorResponse['kind']): Promise<Response | TutorResponse> => {
      const answer = { fixed_message_id: id, text: FIXED_MESSAGES[id] };
      const thread = await db.tutorStore(ctx.userId, body.thread_id ?? null, body.message, kind, answer);
      return respond(ctx, { thread_id: thread, kind, blocks: [], fixed_message_id: id, fixed_message: FIXED_MESSAGES[id], dropped_unverified_count: 0 }, stream);
    };

    // Deterministic checks first: no model call, no tokens.
    if (detectCrisis(body.message)) return await fixed('crisis_support', 'crisis_support');
    const declined = detectDeclined(body.message);
    if (declined) return await fixed(declined, 'declined');

    const moderation = await cfg.provider.moderate(body.message);
    await db.ledgerAdd(ctx.userId, ctx.requestId, 'moderation', moderation.tokens, 0);
    if (moderation.selfHarm) return await fixed('crisis_support', 'crisis_support');
    if (moderation.flagged) return await fixed('declined_moderation', 'declined');

    const journal = await db.journalForAi(ctx.userId, body.journal_entry_ids ?? []);
    const translation = body.translation ?? (await db.getProfile(ctx.userId)).translation_code;

    const embedded = await cfg.provider.embed([body.message]);
    await db.ledgerAdd(ctx.userId, ctx.requestId, 'embedding', embedded.tokens, 0);
    const minSimilarity = num(cfg.env.get('AI_MIN_SIMILARITY'), 0.2);
    const chunks = (await db.matchChunks(embedded.vectors[0] as number[], 6, null)).filter((c) => c.similarity >= minSimilarity);
    if (chunks.length === 0) return await fixed('no_relevant_content', 'no_relevant_content');

    const context = chunks.map((c) => ({
      id: c.id,
      label: c.book ? `${c.book} ${c.chapter}:${c.verse_start}${c.verse_end ? `-${c.verse_end}` : ''}` : c.source_type,
      text: c.content,
    }));
    const generated = await cfg.provider.generate({ system: SYSTEM_PROMPT, question: body.message, context, journal });
    await db.ledgerAdd(ctx.userId, ctx.requestId, 'tutor', generated.inputTokens, generated.outputTokens);

    const parsed = rawOutput.safeParse(generated.json);
    if (!parsed.success) return await fixed('generation_failed', 'declined');

    const lookup: VerseLookup = async (ref) => {
      const r = await db.scriptureVerses(ctx.userId, ref, translation);
      return r ? { translation: r.translation, verses: r.verses } : null;
    };
    const verified = await verifyBlocks(parsed.data.blocks as RawBlock[], lookup, context.map((c) => c.text));
    if (verified.blocks.length === 0) {
      if (verified.dropped > 0) return await fixed('generation_failed', 'declined');
      return await fixed('no_relevant_content', 'no_relevant_content');
    }
    const thread = await db.tutorStore(ctx.userId, body.thread_id ?? null, body.message, 'answer', { blocks: verified.blocks });
    return respond(ctx, { thread_id: thread, kind: 'answer', blocks: verified.blocks, fixed_message_id: null, fixed_message: null, dropped_unverified_count: verified.dropped }, stream);
  };
}

export { json };
