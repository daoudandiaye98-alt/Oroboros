// Mare Liberum · build the sea: pull every public lake, normalize to ARD-shaped rows, write one open data file.
// Usage: node tools/build.mjs            (pull live)        node tools/build.mjs --cache   (reuse data/*.ndjson)
import { createWriteStream, existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { normMcp, normX402, readDomain } from '../node/core.mjs';
import { hayOf, metaOf } from '../node/mem.mjs';

const UA = 'MareLiberum/1.0 (open agent index; pull-only)';
const CACHE = process.argv.includes('--cache');
const LAKES = [
  { name: 'mcp-registry', cursor: true, url: 'https://registry.modelcontextprotocol.io/v0/servers?version=latest&limit=100', items: (j) => j.servers, norm: (x) => normMcp(x) },
  { name: 'x402-bazaar', url: 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources?limit=100', items: (j) => j.items, norm: (x) => normX402(x, 'x402-bazaar') },
  { name: 'x402-payai', url: 'https://facilitator.payai.network/discovery/resources?limit=100', items: (j) => j.items, norm: (x) => normX402(x, 'x402-payai') },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.json(); if (r.status === 429) await sleep(5000 * (i + 1)); } catch {}
    await sleep(1000 * (i + 1));
  }
  throw new Error('lake_unreachable ' + u);
}
async function pull(lake) {
  const rows = []; let cursor = '', offset = 0, total = 0, pages = 0;
  for (;;) {
    const j = await get(lake.url + (lake.cursor ? (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '') : `&offset=${offset}`));
    const items = lake.items(j) || [];
    for (const it of items) { const r = lake.norm(it); if (r) rows.push(r); }
    pages++; if (pages % 100 === 0) console.log(`  ${lake.name}: ${pages} pages, ${rows.length} rows`);
    if (lake.cursor) { cursor = j?.metadata?.nextCursor || ''; if (!cursor) break; await sleep(40); }
    else { offset += items.length; total = j?.pagination?.total || total; if (!items.length || (total && offset >= total)) break; }
  }
  return rows;
}

mkdirSync('data', { recursive: true });
const all = new Map(), lakeStats = {};
const settled = await Promise.allSettled(LAKES.map(async (lake) => {
  const cache = `data/${lake.name}.ndjson`;
  const rows = CACHE && existsSync(cache) ? readFileSync(cache, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : await pull(lake);
  lakeStats[lake.name] = rows.length; console.log(`lake ${lake.name}: ${rows.length} rows`);
  return rows;
}));
settled.forEach((s, i) => { if (s.status === 'fulfilled') for (const r of s.value) all.set(r.id, r); else { lakeStats[LAKES[i].name] = 'pending: ' + s.reason?.message; console.log(`lake ${LAKES[i].name} follows at the next refresh`); } });
if (all.size < 1000) throw new Error('the sea needs at least one full lake to build');

// Domains that speak for themselves: read their own manifests (ARD, AI Catalog, A2A agent card).
const seeds = existsSync('seeds.txt') ? readFileSync('seeds.txt', 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
let joined = 0;
for (const d of seeds) { try { const { rows } = await readDomain(d); for (const r of rows) { all.set(r.id, r); joined++; } console.log(`domain ${d}: ${rows.length} entries`); } catch (e) { console.log(`domain ${d}: follows at the next refresh (${e.message})`); } }
lakeStats['self-published domains'] = joined;
const hosts = new Set();
for (const r of all.values()) for (const e of r.endpoints || []) { if (e.url && e.transport !== 'repository') { try { hosts.add(new URL(e.url).hostname.toLowerCase()); } catch {} } }

const ids = [...all.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const out = createWriteStream('data/sea.tsv');
for (const id of ids) {
  const r = all.get(id);
  for (const k of Object.keys(r)) if (r[k] == null) delete r[k];
  if (!out.write(`${id}\t${metaOf(r)}\t${hayOf(r)}\t${JSON.stringify(r)}\n`)) await new Promise((res) => out.once('drain', res));
}
await new Promise((res) => out.end(res));
writeFileSync('data/build.json', JSON.stringify({ builtAt: new Date().toISOString(), entries: ids.length, endpointHosts: hosts.size, lakes: lakeStats }));
// The source travels with the node: anyone can read it and run a mirror.
mkdirSync('public/source', { recursive: true });
for (const f of ['node/core.mjs', 'node/mem.mjs', 'tools/build.mjs', 'engines/postgres/schema.sql', 'seeds.txt', 'README.md', 'LICENSE']) if (existsSync(f)) cpSync(f, `public/source/${f.split('/').pop()}`);
writeFileSync('public/build.json', readFileSync('data/build.json'));
console.log(`sea built: ${ids.length} entries`);
