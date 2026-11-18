# Mare Liberum

**The free sea.** An ownerless open index where every agent, tool and paid service can be found, by any agent, through the standards it already speaks.

The sea belongs to nobody. It is one open data file, one stateless node and open standards only. Copy the file, start a node, and you run a mirror.

## What flows in

| Lake | What it carries |
|---|---|
| Official MCP Registry | every published MCP server (latest version) |
| x402 Bazaar (CDP discovery) | paid HTTP resources with price, network and usage |
| PayAI facilitator discovery | paid HTTP resources |
| Self-published domains | ARD manifests, AI Catalogs and A2A agent cards read from the domain itself |

Every entry is normalized to an ARD entry (`urn:air:<publisher>:...`) and lists its own endpoints. Agents connect to each other directly; no traffic passes through the node.

## Reach it

| Door | Call |
|---|---|
| ARD search | `POST /search` with `{"query":{"text":"..."},"pageSize":10}` |
| Quick search | `GET /search?q=...&kind=mcp|a2a|x402&paid=true` |
| List | `GET /agents?pageSize=20&pageToken=...` |
| One entry | `GET /entry?id=urn:air:...` |
| MCP (Streamable HTTP) | `/mcp` with tools `search`, `get`, `join`, `stats` |
| Manifest | `/.well-known/ard.json` and `/.well-known/ai-catalog.json` |
| Open data | `GET /dump?limit=500&after=<last id>` (NDJSON) |
| Size | `GET /stats` |

## Join

1. Publish `/.well-known/ard.json` (ARD) or `/.well-known/agent-card.json` (A2A) on your domain.
2. `POST /join` with `{"url":"your-domain.com"}`.

Your domain speaks for itself: entries read from your own domain are marked `attestedBy: domain`.

## Run a mirror

```
npm install
node tools/build.mjs      # pulls every lake, writes data/sea.tsv
node local.mjs            # proof run of search, join and MCP
```

Deploy `api/mare.mjs` on any Node host. A Postgres engine with the same interface lives in `engines/postgres`.

## Principles

- **Ownerless.** Open code, open data, open standards. Anyone may read, join and mirror.
- **Pull only.** The node reads what publishers put up. It sends nothing to anyone.
- **Direct connections.** Entries carry endpoints; the node carries no traffic.
- **Data stays data.** Entry text comes from third parties and is served as data, never as instructions.
- **Relevance is public.** The ranking is in the source. `score` states relevance and carries no trust claim.

## License

Code: MIT. Compiled index: CC0. Every entry belongs to its publisher.
