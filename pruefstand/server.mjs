/**
 * Ein statischer Server, der komprimiert — für ehrliche Messungen.
 *
 *   node pruefstand/server.mjs [port]
 *
 * WARUM NICHT `vite preview`: der liefert unkomprimiert aus. Ein
 * Ladezeit-Test dagegen misst 341 kB JavaScript, wo im Netz 61 kB ankommen,
 * und meldet dann eine Zahl, die mit der ausgelieferten Seite nichts zu tun
 * hat. Gemessen am 20.08.2026: 5,4 s statt der tatsächlichen Zeit.
 *
 * Gzip, nicht Brotli: Vercel liefert Brotli, das wäre also noch etwas
 * günstiger. Die Messung ist damit die pessimistische Seite der Wahrheit —
 * die richtige Richtung, in die man sich irrt.
 *
 * Bilder, Filme und Schriften werden NICHT komprimiert: WebP, MP4 und WOFF2
 * sind es bereits, und ein zweiter Durchgang macht sie nur größer.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createGzip } from "node:zlib";
import { extname, join, normalize } from "node:path";

const WURZEL = "dist";
const PORT = Number(process.argv[2] ?? 4173);

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json",
};

/** Was schon komprimiert ist, wird nicht noch einmal komprimiert. */
const SCHON_DICHT = new Set([".webp", ".png", ".mp4", ".woff", ".woff2", ".svg"]);

createServer((anfrage, antwort) => {
  // `normalize` samt führendem Punkt-Abschnitt entfernen: sonst kommt man mit
  // `../` aus dem Wurzelverzeichnis heraus.
  const pfad = normalize(decodeURIComponent(new URL(anfrage.url, "http://x").pathname))
    .replace(/^(\.\.[/\\])+/, "");
  let datei = join(WURZEL, pfad);

  if (!existsSync(datei) || statSync(datei).isDirectory()) {
    // Eine Anwendung mit einer Hülle: alles, was keine Datei ist, bekommt
    // index.html — dieselbe Umschreibung wie in `vercel.json`.
    datei = join(WURZEL, "index.html");
  }

  const endung = extname(datei);
  const kopf = { "content-type": TYPEN[endung] ?? "application/octet-stream" };

  const willGzip = /\bgzip\b/.test(anfrage.headers["accept-encoding"] ?? "");
  if (willGzip && !SCHON_DICHT.has(endung)) {
    antwort.writeHead(200, { ...kopf, "content-encoding": "gzip" });
    createReadStream(datei).pipe(createGzip()).pipe(antwort);
    return;
  }
  /*
   * Bereichsanfragen, und warum sie hier stehen müssen.
   *
   * Ein `<video>` fordert nicht die ganze Datei an, sondern Stücke — und
   * verlangt dafür `accept-ranges`. Ohne das lädt Chromium die Datei zwar
   * trotzdem, aber erst vollständig, bevor es das erste Bild zeigt. Der
   * Prüfstand misst dann eine Wartezeit, die es im Netz nicht gibt: Vercel
   * beantwortet Bereichsanfragen.
   */
  const groesse = statSync(datei).size;
  const bereich = anfrage.headers.range;
  const treffer = bereich && /^bytes=(\d*)-(\d*)$/.exec(bereich);
  if (treffer) {
    const von = treffer[1] ? Number(treffer[1]) : 0;
    const bis = treffer[2] ? Math.min(Number(treffer[2]), groesse - 1) : groesse - 1;
    antwort.writeHead(206, {
      ...kopf,
      "accept-ranges": "bytes",
      "content-range": `bytes ${von}-${bis}/${groesse}`,
      "content-length": bis - von + 1,
    });
    createReadStream(datei, { start: von, end: bis }).pipe(antwort);
    return;
  }
  antwort.writeHead(200, { ...kopf, "accept-ranges": "bytes", "content-length": groesse });
  createReadStream(datei).pipe(antwort);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`dist/ mit gzip auf http://127.0.0.1:${PORT}`);
});
