import postgres from 'postgres';
import { Db } from '../_shared/db.ts';
import { createWebhookHandler } from './handler.ts';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL') ?? '', { max: 2, prepare: false, idle_timeout: 20 });
Deno.serve(createWebhookHandler({
  db: new Db(sql),
  secret: Deno.env.get('REVENUECAT_WEBHOOK_SECRET'),
  entitlementId: Deno.env.get('REVENUECAT_ENTITLEMENT_ID') ?? 'Rabb.ai Premium',
}));
