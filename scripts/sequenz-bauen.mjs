/**
 * Erzeugt die Bildsequenzen der Landing — drei Formatsätze, je zwei Stufen.
 *
 *   node scripts/sequenz-bauen.mjs
 *
 * Läuft NICHT im Vercel-Build. Die fertigen Frames liegen unter `public/seq/`
 * im Repo, damit die Auslieferung kein ffmpeg braucht.
 *
 * ZWEI STUFEN, WEIL ES ZWEI FRAGEN SIND.
 *   Vorlauf  jeder vierte Frame, klein und grob. Er entscheidet, WANN die
 *            Seite freigegeben wird.
 *   Voll     alle Frames in voller Auflösung, Güte 68. Er entscheidet, WIE
 *            SCHARF das Bild ist, und strömt im Hintergrund nach.
 *
 * ZWEI ABSCHNITTE, WEIL ES ZWEI FILME SIND.
 *   1…100    der Hauptfilm: Wirbel, Düne, Traverse, Einrollen.
 *   101…150  die Rückfahrt: die Kamera zieht zurück, der Ring wird klein.
 *
 * DER HAUPTABSCHNITT WIRD NICHT NEU KODIERT, wo er schon existiert. Der
 * Bauauftrag verbietet es ausdrücklich („Die bestehende Sequenz wird nicht neu
 * kodiert"), und die Prüfung vergleicht die Prüfsummen. Das Skript prüft
 * deshalb, ob die Frames schon da sind, und rührt sie dann nicht an. Nur der
 * 9:16-Satz entsteht vollständig neu — den gab es vorher nicht.
 *
 * DER VORLAUF ENTSTEHT AUS DEN FERTIGEN FRAMES, nicht aus dem Film. Zweimal
 * unabhängig abzutasten hieße, zwei um Sekundenbruchteile verschobene Reihen
 * zu bekommen; beim Ersetzen im Array spränge das Bild. Aus dem fertigen Frame
 * herunterzurechnen kann per Bauart nicht auseinanderlaufen — und es fasst den
 * geschützten Hauptabschnitt nicht an.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

const BILDRATE = 10;
const VORLAUF_SCHRITT = 4;
const VOLL_GUETE = 68;
const HAUPT_FRAMES = 100;
const RUECK_FRAMES = 50;

/**
 * Die drei Sätze.
 *
 * `breite` ist bei 3:4 und 16:9 die Breite, in der der Hauptabschnitt bereits
 * kodiert IST — die Rückfahrt bekommt dieselbe, sonst stünde mitten im Scroll
 * eine sichtbare Schärfekante. Die neuen Quellen liegen in 4K vor; sie hier zu
 * nutzen hieße, den Hauptabschnitt neu zu kodieren, und genau das ist
 * untersagt. Siehe Bericht: mit einem Wort ist das umgestellt.
 *
 * `vorBreite` steht je Satz, weil eine Breite bei drei Seitenverhältnissen
 * drei verschiedene Bildpunktzahlen bedeutet.
 *
 * `rueckDauer` ist der GEMESSENE Grund, warum 16:9 anders behandelt wird.
 * Das Lockup braucht den Ring bei 0,23 der Fensterbreite. Er kommt aus dem
 * Film — die Verwandlung darf ihn nur noch verkleinern, nie vergrößern, sonst
 * steht am schärfsten Moment der Seite ein hochgerechnetes Bild.
 *
 * Am letzten Frame gemessen (Anteil der Bildbreite, Außenkante des Körpers):
 *   3:4    0,2342  →  Maßstab 0,98   ✓
 *   9:16   0,1982  →  Maßstab 0,96   ✓  (bei 390 × 844)
 *   16:9   0,0746  →  Maßstab 2,74   ✗  das wäre 2,7-fach hochgerechnet
 *
 * Die drei Rückfahrten sind verschiedene Aufnahmen. Die 16:9-Fahrt zieht
 * ungleich weiter zurück als die beiden Hochformate; nach 5,04 s ist der Ring
 * dort auf ein Siebtel der Fensterbreite geschrumpft. Bei 0,80 s steht er bei
 * 0,243 — genau das Maß, das das Lockup braucht. Also wird für 16:9 nur diese
 * erste Sekunde abgetastet, dafür mit 62,5 statt 10 Bildern je Sekunde: gleich
 * viele Frames, gleiches Gewicht, nur der richtige Ausschnitt der Fahrt.
 *
 * Nachgeneriert wird dafür nichts. Es ist dieselbe Aufnahme, kürzer gefasst.
 */
const SAETZE = [
  { name: "film-3x4", haupt: "film-3x4", rueck: "rueckfahrt-3x4", breite: 828, hoehe: 1108, vorBreite: 360, vorGuete: 52, rueckDauer: null },
  { name: "film-16x9", haupt: "film-16x9", rueck: "rueckfahrt-16x9", breite: 1284, hoehe: 716, vorBreite: 480, vorGuete: 55, rueckDauer: 0.80 },
  { name: "film-9x16", haupt: "film-9x16", rueck: "rueckfahrt-9x16", breite: 716, hoehe: 1284, vorBreite: 320, vorGuete: 52, rueckDauer: null },
];

/**
 * Skalieren auf EXAKT die Maße des Satzes, nicht auf „Breite und was passt".
 *
 * Der Grund ist an der Fuge gemessen: der Hauptfilm 16:9 ist 1284 × 716
 * (Verhältnis 1,7933), die hochskalierte Rückfahrt exakt 3840 × 2160
 * (1,7778). Mit `scale=1284:-2` wurde die Rückfahrt 1284 × 722 — sechs Pixel
 * höher als der Hauptabschnitt. Beim Übergang von Frame 100 auf 101 hätte der
 * `cover`-Zuschnitt gesprungen, mitten in einer durchgehenden Kamerafahrt.
 *
 * `force_original_aspect_ratio=increase` plus `crop` füllt den Zielrahmen und
 * schneidet den Rest mittig weg — 0,4 bis 0,9 % Bildrand, unsichtbar, und
 * dafür läuft die Fuge glatt durch.
 */
const passend = (s) =>
  `scale=${s.breite}:${s.hoehe}:force_original_aspect_ratio=increase,crop=${s.breite}:${s.hoehe}`;

const zeit = (kb, mbit) => (kb * 8 / 1024 / mbit).toFixed(1);
const nummer = (i) => `f${String(i).padStart(3, "0")}`;

/** Wandelt alle PNG eines Ordners in WebP und löscht die PNG. */
async function nachWebp(ordner, guete) {
  const pngs = readdirSync(ordner).filter((n) => n.endsWith(".png")).sort();
  for (const png of pngs) {
    const von = join(ordner, png);
    await sharp(von).webp({ quality: guete }).toFile(von.replace(/\.png$/, ".webp"));
    unlinkSync(von);
  }
  return pngs.length;
}

function gewicht(ordner) {
  return readdirSync(ordner)
    .filter((n) => n.endsWith(".webp"))
    .reduce((s, n) => s + statSync(join(ordner, n)).size, 0);
}

for (const satz of SAETZE) {
  const voll = join("public/seq", satz.name);
  mkdirSync(voll, { recursive: true });

  /* ————— Hauptabschnitt: nur, wenn er fehlt ————— */
  const hauptDa = existsSync(join(voll, nummer(HAUPT_FRAMES) + ".webp"));
  if (hauptDa) {
    console.log(`${satz.name.padEnd(11)} Hauptabschnitt vorhanden — nicht angefasst`);
  } else {
    execFileSync(ffmpeg, [
      "-hide_banner", "-loglevel", "error",
      "-i", join("assets", `${satz.haupt}.mp4`),
      "-vf", `fps=${BILDRATE},${passend(satz)}`,
      join(voll, "f%03d.png"),
    ]);
    const n = await nachWebp(voll, VOLL_GUETE);
    console.log(`${satz.name.padEnd(11)} Hauptabschnitt neu: ${n} Frames à ${satz.breite}px`);
  }

  /* ————— Rückfahrt: immer, angehängt ab 101 ————— */
  const zwischen = `${voll}--rueck`;
  rmSync(zwischen, { recursive: true, force: true });
  mkdirSync(zwischen, { recursive: true });
  const rueckRate = satz.rueckDauer ? RUECK_FRAMES / satz.rueckDauer : BILDRATE;
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    ...(satz.rueckDauer ? ["-t", String(satz.rueckDauer)] : []),
    "-i", join("assets", `${satz.rueck}.mp4`),
    "-vf", `fps=${rueckRate},${passend(satz)}`,
    "-frames:v", String(RUECK_FRAMES),
    join(zwischen, "f%03d.png"),
  ]);
  await nachWebp(zwischen, VOLL_GUETE);
  const rueck = readdirSync(zwischen).filter((n) => n.endsWith(".webp")).sort();
  rueck.slice(0, RUECK_FRAMES).forEach((n, i) => {
    renameSync(join(zwischen, n), join(voll, nummer(HAUPT_FRAMES + 1 + i) + ".webp"));
  });
  rmSync(zwischen, { recursive: true, force: true });

  /* ————— Vorlauf: aus den fertigen Frames herunterrechnen ————— */
  const vor = `${voll}-vor`;
  rmSync(vor, { recursive: true, force: true });
  mkdirSync(vor, { recursive: true });
  const gesamt = HAUPT_FRAMES + RUECK_FRAMES;
  let vorZahl = 0;
  for (let i = 0; i < gesamt; i += VORLAUF_SCHRITT) {
    await sharp(join(voll, nummer(i + 1) + ".webp"))
      .resize({ width: satz.vorBreite })
      .webp({ quality: satz.vorGuete })
      .toFile(join(vor, nummer(vorZahl + 1) + ".webp"));
    vorZahl++;
  }

  const vg = gewicht(voll);
  const wg = gewicht(vor);
  console.log(
    `${"".padEnd(11)} voll ${String(readdirSync(voll).filter((n) => n.endsWith(".webp")).length).padStart(3)} Frames`
    + ` · ${(vg / 1024 / 1024).toFixed(2)} MB · 1,6 Mbit/s ${zeit(vg / 1024, 1.6)} s`,
  );
  console.log(
    `${"".padEnd(11)} vor  ${String(vorZahl).padStart(3)} Frames à ${satz.vorBreite}px`
    + ` · ${(wg / 1024).toFixed(0)} kB · 1,6 Mbit/s ${zeit(wg / 1024, 1.6)} s`,
  );
}
