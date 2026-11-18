// @ts-nocheck
// Mare Liberum · Postgres engine entry for Deno / Supabase Edge. Apply schema.sql first.
import { handle } from '../../node/core.mjs';
const BASE = Deno.env.get('SUPABASE_URL'), KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
async function db(fn, args) {
  const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ p: args ?? {} }) });
  if (!r.ok) throw new Error(`db_${fn}_${r.status}`);
  return await r.json();
}
Deno.serve((req) => handle(req, db));
