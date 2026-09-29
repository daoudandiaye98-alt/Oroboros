/* Prüfstand · Auslieferung wie auf Vercel.

   `python3 -m http.server` kennt keine sauberen Adressen: /en, /impressum und
   /arbeiten/halden gäbe es dort nicht, der Linkprüfer würde Fehler melden, die
   in Produktion keine sind — oder schlimmer, echte übersehen. Dieser Server
   bildet die zwei Regeln aus vercel.json nach, die die Adressen bestimmen:

     cleanUrls: true       /x.html → 308 /x,  /x → x.html,  /d → d/index.html
     trailingSlash: false  /d/     → 308 /d

   Aufruf allein:  node pruefstand/server.mjs [port]   (Standard 4173)
   Im Audit:       import { starteServer } from './server.mjs'                  */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STANDARD_WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json',
};

function istDatei(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }

/* Löst eine Adresse wie Vercel auf: { status, ort } für Umleitungen,
   { status: 200, datei } für Treffer, { status: 404 } sonst. */
export function loese(adresse, WURZEL = STANDARD_WURZEL) {
  let pfad;
  try { pfad = decodeURIComponent(new URL(adresse, 'http://x').pathname); } catch { return { status: 400 }; }
  if (pfad.includes('\0')) return { status: 400 };
  const ziel = path.join(WURZEL, pfad);
  if (!ziel.startsWith(WURZEL)) return { status: 403 };

  if (pfad.length > 1 && pfad.endsWith('/')) return { status: 308, ort: pfad.replace(/\/+$/, '') || '/' };
  if (/(^|\/)index\.html$/.test(pfad)) return { status: 308, ort: pfad.replace(/\/?index\.html$/, '') || '/' };
  if (pfad.endsWith('.html')) return { status: 308, ort: pfad.slice(0, -5) };

  if (pfad === '/') return istDatei(path.join(WURZEL, 'index.html')) ? { status: 200, datei: path.join(WURZEL, 'index.html') } : { status: 404 };
  if (istDatei(ziel)) return { status: 200, datei: ziel };
  if (istDatei(ziel + '.html')) return { status: 200, datei: ziel + '.html' };
  if (istDatei(path.join(ziel, 'index.html'))) return { status: 200, datei: path.join(ziel, 'index.html') };
  return { status: 404 };
}

export function starteServer(port = 0, WURZEL = STANDARD_WURZEL) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const e = loese(url.pathname, WURZEL);
    if (e.status === 308) {
      res.writeHead(308, { location: e.ort + url.search });
      return res.end();
    }
    if (e.status !== 200) {
      const seite404 = path.join(WURZEL, '404.html');
      if (e.status === 404 && istDatei(seite404)) {
        res.writeHead(404, { 'content-type': TYPEN['.html'] });
        return fs.createReadStream(seite404).pipe(res);
      }
      res.writeHead(e.status, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end(String(e.status));
    }
    const typ = TYPEN[path.extname(e.datei).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': typ, 'cache-control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(e.datei).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = server.address();
      resolve({ basis: `http://127.0.0.1:${p}`, schliessen: () => new Promise((r) => server.close(r)) });
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.argv[2] ?? 4173);
  starteServer(port, process.argv[3] ? path.resolve(process.argv[3]) : STANDARD_WURZEL).then(({ basis }) => console.log(`Prüfstand-Server (wie Vercel, cleanUrls) auf ${basis}/`));
}
