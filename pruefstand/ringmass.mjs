/**
 * Das Messgerät für den Ring.
 *
 *   node pruefstand/ringmass.mjs '[{"datei":"public/seq/film-16x9/f150.webp",
 *                                   "aus":"/tmp/fit.png","marke":"16:9 f150",
 *                                   "cx":0.4935,"cy":0.4977,
 *                                   "dx":0.2332,"dy":0.2519,"fenster":0.5}]'
 *
 * Legt eine Ellipse über einen Frame und schreibt das Ergebnis als Bild raus.
 * Man sieht sofort, ob sie die Außenkante des Schlangenkörpers rundherum
 * berührt, korrigiert die vier Zahlen und ruft noch einmal auf. Nach zwei bis
 * drei Durchgängen steht das Maß auf etwa ein Prozent genau.
 *
 * WARUM NICHT AUTOMATISCH SEGMENTIERT: der Schlangenkörper und der Sand haben
 * dieselbe Farbe. Gemessen an `film-16x9/f150.webp`: Körper rgb(228,186,122),
 * Sand rgb(215,176,121) — Sättigung 0,465 gegen 0,437, Helligkeit 0,894 gegen
 * 0,843. Kein Schwellwert trennt das; ein Segmentierer lieferte einen Treffer
 * im ganzen Suchfenster. Das Auge trennt es sofort, weil es die FORM sieht.
 * Also misst hier das Auge, und der Rechner hält das Lineal.
 *
 * Die so gewonnenen Zahlen stehen in `src/landing/choreografie.ts` unter
 * `RING`. Von dort holt sie die Verwandlung des Schlussbildes — und über
 * `data-ring` am Canvas auch der Selbsttest, damit er nicht denselben Wert
 * ein zweites Mal führen muss.
 */
import sharp from "sharp";
const K = JSON.parse(process.argv[2]);
const ZIEL = 620;
for (const s of K) {
  const { width: w, height: h } = await sharp(s.datei).metadata();
  const seite = Math.min(w, h, Math.round(w * s.fenster));
  const left = Math.max(0, Math.min(w-seite, Math.round(s.cx*w - seite/2)));
  const top  = Math.max(0, Math.min(h-seite, Math.round(s.cy*h - seite/2)));
  const roh = await sharp(s.datei).extract({ left, top, width: seite, height: seite })
    .resize(ZIEL, ZIEL, { fit: "fill", kernel: "nearest" }).png().toBuffer();
  const cxp = (s.cx*w - left)/seite*ZIEL, cyp = (s.cy*h - top)/seite*ZIEL;
  const rx = s.dx/2*w/seite*ZIEL, ry = s.dy/2*w/seite*ZIEL;
  const svg = Buffer.from(`<svg width="${ZIEL}" height="${ZIEL}">
    <ellipse cx="${cxp}" cy="${cyp}" rx="${rx}" ry="${ry}" fill="none" stroke="#ff2bd6" stroke-width="2"/>
    <line x1="${cxp}" y1="${cyp-10}" x2="${cxp}" y2="${cyp+10}" stroke="#ff2bd6"/>
    <line x1="${cxp-10}" y1="${cyp}" x2="${cxp+10}" y2="${cyp}" stroke="#ff2bd6"/>
    <text x="6" y="17" font-size="14" fill="#ff2bd6">${s.marke} c=${s.cx} ${s.cy} d=${s.dx}</text></svg>`);
  await sharp(roh).composite([{input:svg}]).png().toFile(s.aus);
  console.log(s.marke, `${w}x${h}`, "Fenster", seite, "ab", left, top);
}
