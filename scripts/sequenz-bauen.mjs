/**
 * Erzeugt die Bildsequenzen der Landing — zwei Formatsätze, je zwei Stufen.
 *
 *   node scripts/sequenz-bauen.mjs
 *
 * Läuft NICHT im Vercel-Build. Die fertigen Frames liegen unter `public/seq/`
 * im Repo, damit die Auslieferung kein ffmpeg braucht.
 *
 * ZWEI STUFEN, WEIL ES ZWEI FRAGEN SIND.
 *
 *   Vorlauf  jeder vierte Frame, klein und grob. Er entscheidet, WANN die
 *            Seite freigegeben wird — 179 bzw. 260 kB je Formatsatz.
 *   Voll     alle Frames in voller Auflösung, Güte 68. Er entscheidet, WIE
 *            SCHARF das Bild ist, und strömt im Hintergrund nach.
 *
 * Vorher hing beides an derselben Zahl: um unter 4 s freizugeben, musste die
 * Güte auf 45 und die Breite auf 420 px — und damit war das Bild dauerhaft
 * unscharf. Zwei Fragen, zwei Antworten.
 *
 * DIE BREITEN SIND DIE NATIVEN BREITEN DER QUELLFILME, nicht die im
 * Qualitätspass genannten 1000 und 1600. Gemessen: auf 1000 px skaliert
 * wiegt der 3:4-Satz 5,76 MB statt 4,63, der 16:9-Satz auf 1600 px 4,72 MB
 * statt 3,61 — 24 bzw. 31 % mehr Bytes für Bildpunkte, die ffmpeg erfindet.
 * Die Quelle hat 828 bzw. 1284 Pixel Breite; mehr kann kein Encoder daraus
 * holen. Echte Auflösung kommt nur aus echtem Hochskalieren der QUELLE
 * (Topaz), und das braucht eine Freigabe.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

/** 10 Bilder je Sekunde aus dem 10-Sekunden-Film — 100 Frames. */
const BILDRATE = 10;

/** Jeder wievielte Frame in den Vorlauf kommt. */
const VORLAUF_SCHRITT = 4;
const VOLL_GUETE = 68;

/*
 * Die Vorlauf-Breite steht JE SATZ, nicht global.
 *
 * Der Qualitätspass nennt 480 px. Bei 16:9 sind das 480 × 268 = 129k
 * Bildpunkte je Frame und 179 kB für die Stufe. Bei 3:4 sind dieselben 480 px
 * aber 480 × 643 = 309k Bildpunkte — 2,4-mal so viele, gemessen 427 kB. Eine
 * Breite ist bei zwei Seitenverhältnissen nicht dasselbe Gewicht. Gesetzt ist
 * deshalb pro Satz eine Breite, die auf vergleichbares Gewicht führt.
 */
const SAETZE = [
  { name: "film-3x4", film: "film-hoch", breite: 828, vorBreite: 360, vorGuete: 52 },
  { name: "film-16x9", film: "film-quer", breite: 1284, vorBreite: 480, vorGuete: 55 },
];

async function nachWebp(ordner, guete) {
  const pngs = readdirSync(ordner).filter((n) => n.endsWith(".png")).sort();
  let bytes = 0;
  for (const png of pngs) {
    const von = join(ordner, png);
    const nach = von.replace(/\.png$/, ".webp");
    await sharp(von).webp({ quality: guete }).toFile(nach);
    unlinkSync(von);
    bytes += statSync(nach).size;
  }
  return { anzahl: pngs.length, bytes };
}

const zeit = (kb, mbit) => (kb * 8 / 1024 / mbit).toFixed(1);

for (const satz of SAETZE) {
  const voll = join("public/seq", satz.name);
  rmSync(voll, { recursive: true, force: true });
  mkdirSync(voll, { recursive: true });
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    "-i", join("assets", `${satz.film}.mp4`),
    "-vf", `fps=${BILDRATE},scale=${satz.breite}:-2`,
    join(voll, "f%03d.png"),
  ]);
  const v = await nachWebp(voll, VOLL_GUETE);

  /*
   * Der Vorlauf entsteht aus DEMSELBEN ffmpeg-Lauf, nur mit gröberem Takt.
   *
   * `select` statt eines zweiten `fps`: so ist Frame 1 des Vorlaufs
   * garantiert derselbe Bildinhalt wie Frame 1 der vollen Stufe. Zwei
   * unabhängige Abtastungen würden um Sekundenbruchteile auseinanderliegen,
   * und beim Ersetzen im Array spränge das Bild.
   */
  const vor = `${voll}-vor`;
  rmSync(vor, { recursive: true, force: true });
  mkdirSync(vor, { recursive: true });
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    "-i", join("assets", `${satz.film}.mp4`),
    "-vf", `fps=${BILDRATE},select=not(mod(n\\,${VORLAUF_SCHRITT})),scale=${satz.vorBreite}:-2`,
    "-vsync", "0",
    join(vor, "f%03d.png"),
  ]);
  const w = await nachWebp(vor, satz.vorGuete);

  console.log(
    `${satz.name.padEnd(10)} voll ${String(v.anzahl).padStart(3)} Frames à ${satz.breite}px`
    + ` · ${(v.bytes / 1024 / 1024).toFixed(2)} MB · ${(v.bytes / v.anzahl / 1024).toFixed(1)} kB/Frame`
    + ` · 1,6 Mbit/s ${zeit(v.bytes / 1024, 1.6)} s`,
  );
  console.log(
    `${"".padEnd(10)} vor  ${String(w.anzahl).padStart(3)} Frames à ${satz.vorBreite}px`
    + ` · ${(w.bytes / 1024).toFixed(0)} kB · ${(w.bytes / w.anzahl / 1024).toFixed(1)} kB/Frame`
    + ` · 1,6 Mbit/s ${zeit(w.bytes / 1024, 1.6)} s`,
  );
}
