// Mare Liberum · memory engine
// The whole sea is one open data file (data/sea.tsv). This engine answers the same jsonb interface as the
// Postgres engine, so a node needs no database: copy the file, start the node, you run a mirror.
// Line format: id \t kind|paid|domain|quality|lake|hasEndpoint \t haystack \t json-row
import { readFileSync, existsSync } from 'node:fs';
import { kindOf } from './core.mjs';

const KINDS = ['mcp', 'a2a', 'x402', 'skill', 'registry', 'catalog', 'api', 'other'];
const low = (s) => String(s || '').toLowerCase();
export function hayOf(r) {
  return [low(r.display_name), low([...(r.capabilities || []), ...(r.tags || [])].join(' ')),
    low(`${(r.description || '').slice(0, 300)} ${(r.queries || []).join(' ')} ${r.source_ref || ''}`)].join('\u0001').replace(/[\t\n\r]/g, ' ');
}
export const metaOf = (r) => [Math.max(0, KINDS.indexOf(r.kind)), r.pay ? 1 : 0, r.attested_by === 'domain' ? 1 : 0, Number(r.quality || 0).toFixed(1), r.source, (r.endpoints || []).length ? 1 : 0].join('|');

const strip = (o) => { for (const k of Object.keys(o)) { const v = o[k]; if (v == null || (Array.isArray(v) && !v.length)) delete o[k]; else if (typeof v === 'object' && !Array.isArray(v)) { strip(v); if (!Object.keys(v).length) delete o[k]; } } return o; };
export function pub(r, full) {
  return strip({ identifier: r.id, displayName: r.display_name, type: r.type, url: r.url, description: full ? r.description : (r.description || '').slice(0, 280) || null,
    capabilities: r.capabilities, tags: r.tags, version: r.version, updatedAt: r.updated_at, representativeQueries: full ? r.queries : null, data: full ? r.data : null,
    metadata: { kind: r.kind, publisher: r.publisher, endpoints: r.endpoints, pay: r.pay, attestedBy: r.attested_by, lake: r.source, lakeRef: r.source_ref } });
}
const alnum = (c) => (c >= 48 && c <= 57) || (c >= 97 && c <= 122) || c > 127;
function wordIdx(hay, tok) { let i = hay.indexOf(tok); while (i > 0 && alnum(hay.charCodeAt(i - 1))) i = hay.indexOf(tok, i + 1); return i; }
function weigh(hay, toks) {
  let w = 0, b1 = -2, b2 = -2;
  for (const t of toks) { const i = wordIdx(hay, t); if (i < 0) continue; if (b1 === -2) { b1 = hay.indexOf('\u0001'); b2 = hay.indexOf('\u0001', b1 + 1); } w += i < b1 ? 5 : i < b2 ? 3 : 1; }
  return w;
}

export function createMem({ file, base, blobToken } = {}) {
  let built = {}; try { built = JSON.parse(readFileSync(file.replace(/[^/]+$/, 'build.json'), 'utf8')); } catch {}
  let buf = Buffer.alloc(0), n = 0;
  const ids = [], hays = [], lakes = [], lakeIdx = new Map();
  let kind, paid, dom, qual, ep, lake, jOff, jLen;
  const counts = { byKind: {}, byLake: {}, paid: 0, dom: 0, pubs: new Set() };
  if (file && existsSync(file)) {
    buf = readFileSync(file);
    let lines = 0; for (let p = buf.indexOf(10); p !== -1; p = buf.indexOf(10, p + 1)) lines++;
    kind = new Uint8Array(lines); paid = new Uint8Array(lines); dom = new Uint8Array(lines); ep = new Uint8Array(lines); lake = new Uint8Array(lines);
    qual = new Float32Array(lines); jOff = new Uint32Array(lines); jLen = new Uint32Array(lines);
    for (let s = 0; s < buf.length;) {
      const e = buf.indexOf(10, s); if (e === -1) break;
      const t1 = buf.indexOf(9, s), t2 = buf.indexOf(9, t1 + 1), t3 = buf.indexOf(9, t2 + 1);
      if (t1 > 0 && t3 > 0 && t3 < e) {
        const id = buf.toString('utf8', s, t1), m = buf.toString('latin1', t1 + 1, t2).split('|');
        ids.push(id); hays.push(buf.toString('utf8', t2 + 1, t3));
        kind[n] = +m[0]; paid[n] = +m[1]; dom[n] = +m[2]; qual[n] = +m[3]; ep[n] = +m[5];
        if (!lakeIdx.has(m[4])) { lakeIdx.set(m[4], lakes.length); lakes.push(m[4]); }
        lake[n] = lakeIdx.get(m[4]); jOff[n] = t3 + 1; jLen[n] = e - t3 - 1;
        const k = KINDS[kind[n]]; counts.byKind[k] = (counts.byKind[k] || 0) + 1; counts.byLake[m[4]] = (counts.byLake[m[4]] || 0) + 1;
        counts.paid += paid[n]; counts.dom += dom[n]; counts.pubs.add(id.split(':')[2]);
        n++;
      }
      s = e + 1;
    }
  }
  const row = (i) => JSON.parse(buf.toString('utf8', jOff[i], jOff[i] + jLen[i]));
  const find = (id) => { let lo = 0, hi = n - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (ids[mid] === id) return mid; if (ids[mid] < id) lo = mid + 1; else hi = mid - 1; } return -1; };
  const upper = (id) => { let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (ids[mid] <= id) lo = mid + 1; else hi = mid; } return lo; };

  // entries that joined at runtime (kept durable in a blob store when the node has one)
  const extra = new Map(); let extraAt = 0, blob = null;
  const addExtra = (r) => { if (r?.id && r.display_name) extra.set(r.id, { r, hay: hayOf(r) }); };
  async function syncExtra(force) {
    if (!blobToken || (!force && Date.now() - extraAt < 60000)) return;
    extraAt = Date.now();
    try {
      blob ||= await import('@vercel/blob');
      const { blobs } = await blob.list({ prefix: 'joins/', limit: 1000, token: blobToken });
      await Promise.all(blobs.map(async (b) => { try { const rows = await (await fetch(b.url, { signal: AbortSignal.timeout(8000) })).json(); for (const r of Array.isArray(rows) ? rows : []) addExtra(r); } catch {} }));
    } catch (e) { console.error('mare_blob_sync', e?.message); }
  }
  const rate = new Map();

  const ops = {
    async mare_upsert(p) {
      const rows = (p?.rows || []).filter((r) => r?.id && r.display_name && r.type);
      for (const r of rows) addExtra(r);
      if (blobToken && rows.length) {
        blob ||= await import('@vercel/blob');
        const by = new Map(); for (const r of rows) by.set(r.publisher, [...(by.get(r.publisher) || []), r]);
        for (const [host, list] of by) await blob.put(`joins/${host}.json`, JSON.stringify(list), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token: blobToken });
      }
      return { upserted: rows.length };
    },
    async mare_search(p) {
      await syncExtra();
      const toks = String(p?.tsq || '').split('|').map((t) => t.trim().replace(/:\*$/, '')).filter(Boolean);
      if (!toks.length) return { results: [] };
      const lim = Math.min(Math.max(Number(p.limit) || 10, 1), 100), off = Math.max(Number(p.offset) || 0, 0), max = 5 * toks.length;
      const ks = new Set([...(p.kinds || []), ...(p.types || []).map(kindOf)].map((k) => KINDS.indexOf(k)).filter((k) => k >= 0));
      const wantPaid = p.paid === true ? 1 : p.paid === false ? 0 : -1, hits = [];
      const score = (w, q, d, e) => Math.min(100, Math.round((w / max) * 82 + q + d * 6 + e * 2));
      for (let i = 0; i < n; i++) {
        if (ks.size && !ks.has(kind[i])) continue;
        if (wantPaid >= 0 && paid[i] !== wantPaid) continue;
        const w = weigh(hays[i], toks); if (w) hits.push([score(w, qual[i], dom[i], ep[i]), i]);
      }
      for (const [id, x] of extra) {
        if (find(id) >= 0) continue;
        const k = KINDS.indexOf(x.r.kind);
        if ((ks.size && !ks.has(k)) || (wantPaid >= 0 && (x.r.pay ? 1 : 0) !== wantPaid)) continue;
        const w = weigh(x.hay, toks); if (w) hits.push([score(w, Number(x.r.quality || 0), x.r.attested_by === 'domain' ? 1 : 0, (x.r.endpoints || []).length ? 1 : 0), -1, x.r]);
      }
      hits.sort((a, b) => b[0] - a[0] || ((a[2]?.id || ids[a[1]]) < (b[2]?.id || ids[b[1]]) ? -1 : 1));
      return { results: hits.slice(off, off + lim).map((h) => ({ ...pub(h[2] || row(h[1]), false), score: h[0] })) };
    },
    async mare_get(p) { await syncExtra(); const x = extra.get(p?.id); if (x) return pub(x.r, true); const i = find(String(p?.id || '')); return i < 0 ? null : pub(row(i), true); },
    async mare_list(p) {
      await syncExtra();
      const lim = Math.min(Math.max(Number(p?.limit) || 20, 1), 1000), full = !!p?.full, out = [];
      const want = (id, k, t) => (!p.kind || k === p.kind) && (!p.publisher || id.split(':')[2] === p.publisher) && (!p.type || t() === p.type);
      const ex = [...extra.keys()].filter((id) => find(id) < 0 && (!p.after || id > p.after)).sort(); let xi = 0;
      const pushExtra = (before) => { while (xi < ex.length && (before == null || ex[xi] < before) && out.length < lim) { const r = extra.get(ex[xi++]).r; if (want(r.id, r.kind, () => r.type)) out.push(pub(r, full)); } };
      for (let i = p?.after ? upper(p.after) : 0; i < n && out.length < lim; i++) {
        pushExtra(ids[i]); if (out.length >= lim) break;
        let r; if (want(ids[i], KINDS[kind[i]], () => (r = row(i)).type)) out.push(pub(extra.get(ids[i])?.r || r || row(i), full));
      }
      pushExtra(null);
      return { entries: out, last: out.length ? out[out.length - 1].identifier : null };
    },
    async mare_stats() {
      await syncExtra();
      const s = { entries: n, publishers: new Set(counts.pubs), paid: counts.paid, domainAttested: counts.dom, byKind: { ...counts.byKind }, byLake: { ...counts.byLake } };
      for (const [id, x] of extra) { if (find(id) >= 0) continue; s.entries++; s.publishers.add(x.r.publisher); if (x.r.pay) s.paid++; if (x.r.attested_by === 'domain') s.domainAttested++; s.byKind[x.r.kind] = (s.byKind[x.r.kind] || 0) + 1; s.byLake[x.r.source] = (s.byLake[x.r.source] || 0) + 1; }
      return { ...s, publishers: s.publishers.size, endpointHosts: built.endpointHosts, builtAt: built.builtAt, engine: 'memory', durableJoins: !!blobToken };
    },
    async mare_state_get(p) { return p?.key === 'base' ? base || null : p?.key === 'durable' ? !!blobToken : null; },
    async mare_state_set() { return { ok: true }; },
    async mare_rate_hit(p) {
      const w = Math.floor(Date.now() / 1000 / Math.max(Number(p.window) || 1, 1)), k = `${p.key}:${w}`, c = (rate.get(k) || 0) + 1;
      rate.set(k, c); if (rate.size > 5000) rate.clear();
      return { ok: c <= Number(p.max), n: c };
    },
  };
  const db = (fn, args) => { if (!ops[fn]) throw new Error(`unknown_op_${fn}`); return ops[fn](args || {}); };
  db.size = () => n; db.warm = () => syncExtra(true);
  return db;
}
