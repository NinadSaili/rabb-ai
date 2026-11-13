import { writeFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ENDPOINTS, ERROR_CODES, ERROR_RESPONSE_SCHEMA } from '../packages/contracts/src/index';

const schema = (s: Parameters<typeof zodToJsonSchema>[0]) => {
  const out = zodToJsonSchema(s, { $refStrategy: 'none' }) as Record<string, unknown>;
  delete out['$schema'];
  return JSON.stringify(out, null, 2);
};

const lines: string[] = [];
lines.push('# API specification', '');
lines.push('Generated from `packages/contracts` by `pnpm docs:api`. Do not edit by hand.', '');
lines.push('## Conventions', '');
lines.push(
  '- Base path `/v1` on Supabase Edge Functions. JSON over HTTPS.',
  '- Authentication: `Authorization: Bearer <Supabase JWT>` (anonymous sessions are valid). The webhook uses its own secret.',
  '- Every mutation carries `idempotency_key` (UUID v4). A retry returns the original result with `replayed: true`. Reusing a key with a different payload returns 409 `idempotency_key_reuse`.',
  '- Server time is authoritative. `client_timestamp` is diagnostic only and never used for logic.',
  '- Per user rate limits apply to every endpoint (429 `rate_limited`).',
  '- Request bodies and responses are validated with Zod. Unknown fields in requests are rejected.',
  '- Logs carry the request id and never carry request bodies, prayer text, journal text, tutor messages or app identities.',
  '',
  '### Error envelope',
  '',
  '```json',
  schema(ERROR_RESPONSE_SCHEMA),
  '```',
  '',
  `Error codes: ${ERROR_CODES.map((c) => '`' + c + '`').join(', ')}.`,
  '',
);
lines.push('## Endpoints', '');
for (const e of ENDPOINTS) {
  lines.push(`### ${e.method} ${e.path}`, '', e.summary, '');
  lines.push(`- Auth: ${e.auth === 'jwt' ? 'JWT' : 'webhook authorization secret'}`);
  if (e.premium) lines.push('- Entitlement: Rabb.ai Premium required, enforced server side (403 `premium_required`).');
  lines.push(`- Errors: ${e.errors.map((c) => '`' + c + '`').join(', ')}`);
  if (e.notes) lines.push(`- Notes: ${e.notes}`);
  lines.push('');
  if (e.request) {
    lines.push(e.method === 'GET' ? 'Query parameters:' : 'Request body:', '', '```json', schema(e.request), '```', '');
  }
  lines.push('Response 200:', '', '```json', schema(e.response), '```', '');
}
writeFileSync(new URL('../docs/API_SPECIFICATION.md', import.meta.url), lines.join('\n'));
console.warn(`wrote docs/API_SPECIFICATION.md (${ENDPOINTS.length} endpoints)`);
