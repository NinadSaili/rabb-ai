import { z } from 'zod';
import { isoTimestamp } from './common.ts';

export const deleteAccountRequest = z.object({ confirm: z.literal('DELETE') });
export const deleteAccountResponse = z.object({ status: z.literal('deleted'), deleted_at: isoTimestamp });
