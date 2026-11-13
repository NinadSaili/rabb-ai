import type { ZodTypeAny } from 'zod';
import { z } from 'zod';
import { apiError, ERROR_CODES } from './common';
import { deleteAccountRequest, deleteAccountResponse } from './account';
import { habitsSummaryResponse } from './habits';
import { answerRequest, answerResponse, quizRequest, quizResponse } from './learning';
import { completeRequest, completeResponse, completeStepRequest, completeStepResponse, dailyRitualQuery, dailyRitualResponse, startRequest, startResponse } from './ritual';
import { createScheduleRequest, createScheduleResponse, schedulesResponse } from './schedules';
import { subscriptionStatusResponse, revenueCatEvent } from './subscription';
import { tutorRequest, tutorResponse } from './tutor';

export interface EndpointSpec {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  auth: 'jwt' | 'webhook_secret';
  premium?: boolean;
  /** Query for GET, JSON body for POST. */
  request: ZodTypeAny | null;
  response: ZodTypeAny;
  errors: readonly (typeof ERROR_CODES)[number][];
  notes?: string;
}

const common = ['unauthenticated', 'validation_failed', 'rate_limited', 'internal'] as const;

export const ENDPOINTS: readonly EndpointSpec[] = [
  { method: 'GET', path: '/v1/daily/ritual', summary: "Today's verse, prayer, timer and session state for the user's local ritual date.", auth: 'jwt', request: dailyRitualQuery, response: dailyRitualResponse, errors: [...common, 'not_found'] },
  { method: 'POST', path: '/v1/ritual/start', summary: 'Start a ritual session bound to the server computed local date.', auth: 'jwt', request: startRequest, response: startResponse, errors: [...common, 'not_found', 'conflict', 'idempotency_key_reuse'] },
  { method: 'POST', path: '/v1/ritual/complete-step', summary: 'Record scripture, prayer or timer completion. Timer steps are validated against server time.', auth: 'jwt', request: completeStepRequest, response: completeStepResponse, errors: [...common, 'not_found', 'timer_invalid', 'illegal_transition', 'idempotency_key_reuse'] },
  { method: 'POST', path: '/v1/ritual/complete', summary: 'Complete the ritual once every required step is recorded. First completion for (schedule, local date) wins.', auth: 'jwt', request: completeRequest, response: completeResponse, errors: [...common, 'not_found', 'illegal_transition', 'idempotency_key_reuse'] },
  { method: 'GET', path: '/v1/habits/summary', summary: 'Streaks, week view and counts. Uses server local dates.', auth: 'jwt', request: null, response: habitsSummaryResponse, errors: common },
  { method: 'GET', path: '/v1/schedules', summary: "List the user's schedules.", auth: 'jwt', request: null, response: schedulesResponse, errors: common },
  { method: 'POST', path: '/v1/schedules', summary: 'Create a schedule.', auth: 'jwt', request: createScheduleRequest, response: createScheduleResponse, errors: [...common, 'idempotency_key_reuse'] },
  { method: 'POST', path: '/v1/learning/quiz', summary: 'Start a quiz from approved cached questions.', auth: 'jwt', premium: true, request: quizRequest, response: quizResponse, errors: [...common, 'premium_required', 'not_found'] },
  { method: 'POST', path: '/v1/learning/answer', summary: 'Answer a quiz question.', auth: 'jwt', premium: true, request: answerRequest, response: answerResponse, errors: [...common, 'premium_required', 'not_found', 'idempotency_key_reuse'] },
  { method: 'POST', path: '/v1/ai/tutor', summary: 'Ask the AI Bible tutor. Returns verified blocks, or streams them as server sent events when Accept is text/event-stream.', auth: 'jwt', premium: true, request: tutorRequest, response: tutorResponse, errors: [...common, 'premium_required', 'quota_exceeded', 'feature_disabled'] },
  { method: 'GET', path: '/v1/subscription/status', summary: 'Entitlement status read from the server. The client never trusts a local premium flag.', auth: 'jwt', request: null, response: subscriptionStatusResponse, errors: common },
  { method: 'POST', path: '/v1/account/delete', summary: 'Delete the account and all user data.', auth: 'jwt', request: deleteAccountRequest, response: deleteAccountResponse, errors: common },
  { method: 'POST', path: '/revenuecat-webhook', summary: 'RevenueCat webhook. Only writer of subscriptions. Idempotent by event id.', auth: 'webhook_secret', request: revenueCatEvent, response: z.object({ status: z.enum(['processed', 'duplicate', 'ignored']) }), errors: ['unauthenticated', 'validation_failed', 'internal'], notes: 'Authorization header must equal the configured secret. Replays return duplicate with HTTP 200.' },
];

export const ERROR_RESPONSE_SCHEMA = apiError;
