// Mare Liberum · HTTP entry for Node hosts (Vercel Functions). One warm instance holds the whole sea in memory.
import { join } from 'node:path';
import { handle } from '../node/core.mjs';
import { createMem } from '../node/mem.mjs';

const base = process.env.MARE_BASE || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
const db = createMem({ file: join(process.cwd(), 'data', 'sea.tsv'), base, blobToken: process.env.BLOB_READ_WRITE_TOKEN });

async function run(request) {
  const p = new URL(request.url).searchParams.get('__p');
  return handle(request, db, p ? { path: p.startsWith('/') ? p : `/${p}` } : {});
}
export const GET = run, POST = run, OPTIONS = run;
