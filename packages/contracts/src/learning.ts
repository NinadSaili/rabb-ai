import { z } from 'zod';
import { idempotencyKey, uuid } from './common.ts';

export const quizRequest = z.object({
  lesson_id: uuid,
  count: z.number().int().min(1).max(10).default(5),
});
export const quizQuestion = z.object({
  id: uuid,
  prompt: z.string(),
  choices: z.array(z.string()).min(2).max(6),
});
export const quizResponse = z.object({
  attempt_id: uuid,
  lesson_id: uuid,
  questions: z.array(quizQuestion).min(1),
});

export const answerRequest = z.object({
  attempt_id: uuid,
  question_id: uuid,
  choice_index: z.number().int().min(0).max(5),
  idempotency_key: idempotencyKey,
});
export const answerResponse = z.object({
  correct: z.boolean(),
  correct_index: z.number().int().min(0).max(5),
  explanation: z.string().nullable(),
  attempt_complete: z.boolean(),
  score: z.number().int().min(0).nullable(),
  replayed: z.boolean(),
});
