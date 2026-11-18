// Local proof run: the node core on the memory engine with the full sea file.
import { handle } from './node/core.mjs';
import { createMem } from './node/mem.mjs';
const t0 = performance.now();
const db = createMem({ file: 'data/sea.tsv', base: 'https://mare.local' });
console.log(`cold start: ${db.size()} entries in ${Math.round(performance.now() - t0)} ms, rss ${Math.round(process.memoryUsage().rss / 1e6)} MB`);
const call = async (method, path, body) => {
  const t = performance.now();
  const r = await handle(new Request('https://mare.local' + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' }, body: body ? JSON.stringify(body) : undefined }), db);
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt; }
  return { status: r.status, ms: Math.round(performance.now() - t), j };
};
const line = (label, v) => console.log(`${label}: ${typeof v === 'string' ? v : JSON.stringify(v)}`.slice(0, 420));
const brief = (x) => x.j.results?.map((r) => `${r.score} ${r.metadata.kind} ${r.displayName}`);
let r;
r = await call('GET', '/stats'); line('stats', r.j);
r = await call('POST', '/search', { query: { text: 'read a web page as clean markdown' }, pageSize: 5 }); line(`search web-read ${r.ms}ms`, brief(r));
r = await call('POST', '/search', { query: { text: 'find me a flight booking agent' }, pageSize: 5 }); line(`search flights ${r.ms}ms`, brief(r));
r = await call('GET', '/search?q=postgres%20database&kind=mcp&pageSize=4'); line(`search mcp postgres ${r.ms}ms`, brief(r));
r = await call('GET', '/search?q=token%20price&paid=true&pageSize=3'); line(`search paid token price ${r.ms}ms`, r.j.results?.map((x) => `${x.score} ${x.displayName} $${x.metadata.pay?.priceUsd}`));
r = await call('POST', '/search', { query: { text: 'Übersetzung Deutsch Englisch' }, pageSize: 3 }); line(`search german ${r.ms}ms`, brief(r));
r = await call('POST', '/search', { query: { text: 'angel guard prompt injection' }, pageSize: 3 }); line(`search angel before join ${r.ms}ms`, brief(r));
r = await call('POST', '/join', { url: 'angel.oroboros-design.com' }); line(`join angel ${r.ms}ms`, r.j);
r = await call('POST', '/search', { query: { text: 'angel guard prompt injection' }, pageSize: 3 }); line(`search angel after join ${r.ms}ms`, r.j.results?.map((x) => `${x.score} ${x.metadata.attestedBy} ${x.identifier}`));
r = await call('GET', '/entry?id=' + encodeURIComponent('urn:air:angel.oroboros-design.com:a2a:angel-agent-web-payment-guard')); line('entry angel', { status: r.status, endpoints: r.j.metadata?.endpoints, pay: r.j.metadata?.pay });
r = await call('GET', '/agents?pageSize=3&kind=a2a'); line('agents a2a', r.j.agents?.map((a) => a.identifier));
r = await call('GET', '/agents?pageSize=2'); const tok = r.j.nextPageToken; line('agents page 1', r.j.agents?.map((a) => a.identifier));
r = await call('GET', '/agents?pageSize=2&pageToken=' + encodeURIComponent(tok)); line('agents page 2', r.j.agents?.map((a) => a.identifier));
r = await call('GET', '/dump?limit=3'); line('dump lines', String(r.j).split('\n').filter(Boolean).length);
r = await call('GET', '/.well-known/ard.json'); line('manifest', r.j.entries.map((e) => e.identifier));
r = await call('POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }); line('mcp init', r.j.result.serverInfo);
r = await call('POST', '/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search', arguments: { query: 'weather forecast', kind: 'mcp', limit: 3 } } }); line(`mcp search ${r.ms}ms`, r.j.result.structuredContent.results.map((x) => x.displayName));
r = await call('POST', '/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'stats', arguments: {} } }); line('mcp stats', r.j.result.structuredContent.entries);
r = await call('POST', '/join', { url: 'https://localhost' }); line('join localhost', r.status + ' ' + r.j.error?.message);
r = await call('POST', '/ingest/mcp'); line('ingest closed on this engine', r.status);
r = await call('POST', '/search', { query: {} }); line('search empty', r.status);
r = await call('GET', '/nope'); line('unknown', r.status);
let fails = 0; for (let i = 0; i < 25; i++) { const x = await call('GET', '/join?url=example.com'); if (x.status === 429) fails++; } line('join rate limit hits after 25 calls', fails);
