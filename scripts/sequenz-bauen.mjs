/**
 * Erzeugt die eine Bildsequenz der Landing aus dem einen Quellfilm.
 *
 *   node scripts/sequenz-bauen.mjs
 *
 * Läuft NICHT im Vercel-Build. Die fertigen Frames liegen unter
 * `public/seq/film-p/` im Repo, damit die Auslieferung kein ffmpeg braucht.
 * Dieses Skript ist der Weg, sie zu erneuern — nicht der Weg, sie auszuliefern.
 *
 * DIE ZAHLEN SIND EIN BUDGET, KEIN GESCHMACK.
 *
 * Der Bauauftrag nennt 5 Bilder je Sekunde, 460 px, Güte 48 — und rechnet
 * daraus 3,5 s bei Lighthouse' „Slow 4G". Diese Rechnung zählt aber nur die
 * Sequenz. Durch dieselbe Leitung kommen auch JavaScript, Stylesheet und
 * Schriften: gemessen 125 kB, plus rund 0,8 s für Verbindungsaufbau und das
 * Entpacken von vierzig WebP. Mit der Originalrezeptur waren es 5,0 s.
 *
 * Der Auftrag nennt den Hebel selbst: „dann Framezahl oder Breite senken,
 * nicht die Vorgabe." Beides ein Stück — 4 Bilder je Sekunde, 420 px,
 * Güte 45 — ergibt 482 kB und 3,8 s. Gemessen, nicht gerechnet.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

const BILDRATE = 4;
const BREITE = 420;
const GUETE = 45;
const ZIEL = "public/seq/film-p";
const DECKEL_KB = 780;

rmSync(ZIEL, { recursive: true, force: true });
mkdirSync(ZIEL, { recursive: true });

execFileSync(ffmpeg, [
  "-hide_banner", "-loglevel", "error",
  "-i", "assets/film-hoch.mp4",
  "-vf", `fps=${BILDRATE},scale=${BREITE}:-2`,
  join(ZIEL, "f%03d.png"),
]);

const pngs = readdirSync(ZIEL).filter((n) => n.endsWith(".png")).sort();
let bytes = 0;
for (const png of pngs) {
  const von = join(ZIEL, png);
  const nach = von.replace(/\.png$/, ".webp");
  await sharp(von).webp({ quality: GUETE }).toFile(nach);
  unlinkSync(von);
  bytes += statSync(nach).size;
}

const kb = Math.round(bytes / 1024);
console.log(
  `${pngs.length} Frames · ${kb} kB gesamt · ${(bytes / pngs.length / 1024).toFixed(1)} kB je Frame`,
);
/** Was ausser der Sequenz noch durch dieselbe Leitung muss (gemessen). */
const SEITE_KB = 125;
/** Verbindungsaufbau und Entpacken, die keine Bandbreite sind (gemessen). */
const RUEST_S = 0.8;
for (const [netz, mbit] of [["Slow 4G", 1.6], ["LTE", 10], ["WLAN", 30]]) {
  const s = (kb + SEITE_KB) * 8 / 1024 / mbit + RUEST_S;
  console.log(`  ${netz.padEnd(8)} ${mbit.toString().padStart(4)} Mbit/s → ${s.toFixed(1)} s bis zur Freigabe (mit Seite und Rüstzeit)`);
}
if (kb > DECKEL_KB) {
  console.error(`\nÜBER DEM DECKEL: ${kb} kB > ${DECKEL_KB} kB. Framezahl oder Breite senken.`);
  process.exit(1);
}
