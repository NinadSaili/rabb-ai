import { z } from 'zod';
import { scriptureReference, uuid } from './common.ts';

export const tutorRequest = z.object({
  thread_id: uuid.optional(),
  message: z.string().min(1).max(2000),
  translation: z.string().min(2).max(12).optional(),
  /** Journal entries the user explicitly opted in for this question. Each entry must also have ai_opt_in = true. */
  journal_entry_ids: z.array(uuid).max(3).optional(),
});

export const scriptureBlock = z.object({
  type: z.literal('scripture'),
  reference: scriptureReference,
  translation: z.string(),
  text: z.string(),
  verified: z.literal(true),
});
export const commentaryBlock = z.object({
  type: z.literal('commentary'),
  text: z.string().min(1).max(4000),
  references: z.array(scriptureReference).max(8),
  /** Disputed doctrine is labelled as interpretation, with the position named. */
  label: z.enum(['interpretation', 'historical_context', 'explanation']),
});
export const tutorBlock = z.discriminatedUnion('type', [scriptureBlock, commentaryBlock]);
export type TutorBlock = z.infer<typeof tutorBlock>;

export const tutorResponse = z.object({
  thread_id: uuid,
  kind: z.enum(['answer', 'no_relevant_content', 'crisis_support', 'declined']),
  blocks: z.array(tutorBlock),
  /** Fixed message for crisis_support, declined and no_relevant_content. */
  fixed_message_id: z.string().nullable(),
  /** Text of the fixed message, so crisis support never depends on client copy. */
  fixed_message: z.string().nullable(),
  dropped_unverified_count: z.number().int().min(0),
});
export type TutorResponse = z.infer<typeof tutorResponse>;

/** Server sent events when streaming: one block per event, then a done event. */
export const tutorStreamEvent = z.discriminatedUnion('event', [
  z.object({ event: z.literal('block'), data: tutorBlock }),
  z.object({ event: z.literal('done'), data: tutorResponse.omit({ blocks: true }) }),
]);
