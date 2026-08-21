/**
 * Baut den Prolog — einen Film je Formatsatz, aus zwei Aufnahmen und einem
 * Halt dazwischen.
 *
 *   node scripts/prolog-bauen.mjs
 *
 * ————————————————————————————————————————————————————————————————————————
 * WARUM HIER EIN FILM STEHT UND KEINE BILDFOLGE
 * ————————————————————————————————————————————————————————————————————————
 *
 * Die Heldensequenz ist eine Bildfolge, weil sie am Rollbalken hängt: der
 * Mensch bestimmt Richtung und Tempo, und ein Videodekoder springt dabei
 * schlecht. Der Prolog läuft in EINER Richtung und in Echtzeit. Genau dafür
 * ist ein Dekoder gebaut.
 *
 * Der Preis einer Bildfolge wäre hier hoch: zehn Sekunden bei 24 Bildern
 * wären 264 Frames je Satz. Bei zehn Bildern je Sekunde — dem Takt der
 * Heldensequenz — wären es 110, und eine Kamerafahrt bei zehn Bildern sieht
 * billig aus. Der Film wiegt 1,1 MB und läuft mit 24.
 *
 * Gezeichnet wird er trotzdem auf dieselbe Leinwand wie die Heldensequenz,
 * mit derselben `cover`-Rechnung. An der Fuge ändert sich damit weder Maßstab
 * noch Ausschnitt — es wechselt nur die Quelle des Bildes.
 *
 * ————————————————————————————————————————————————————————————————————————
 * DER STURM LÄUFT RÜCKWÄRTS, UND DAS IST DER GRUND FÜR SEINE EXISTENZ
 * ————————————————————————————————————————————————————————————————————————
 *
 * `assets/sturm-*.mp4` zeigt vorwärts, wie ein Sandsturm das Tier
 * verschlingt. Erzeugt wurde es so herum, weil ein Modell aus einem klaren
 * Bild verlässlich Sand macht und umgekehrt nicht. Rückwärts abgespielt klart
 * derselbe Sturm auf — mit der Physik, die eine echte Aufnahme hat, weil es
 * eine ist. `-vf reverse` ist deshalb keine Spielerei, sondern die Aufnahme.
 *
 * ————————————————————————————————————————————————————————————————————————
 * DER HALT IST EINGEBACKEN, NICHT PROGRAMMIERT
 * ————————————————————————————————————————————————————————————————————————
 *
 * Zwischen Aufklaren und Schwenk stehen 900 ms auf dem Tier. Sie liegen im
 * Film, nicht im Code: ein Halt, den die Laufzeit erzeugt, ist ein Pausieren
 * und Fortsetzen des Dekoders — zwei Stellen, an denen ein Bild stehen bleibt
 * oder springt. Als Standbilder im Film ist es eine Fuge weniger.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";

const HALT_MS = 900;
const BILDRATE = 24;
const GUETE = 30;

const SAETZE = [
  { name: "3x4", breite: 828, hoehe: 1108 },
  { name: "16x9", breite: 1284, hoehe: 716 },
];

const ziel = "public/prolog";
mkdirSync(ziel, { recursive: true });

for (const s of SAETZE) {
  const roh = `scripts/tmp/prolog-${s.name}`;
  rmSync(roh, { recursive: true, force: true });
  mkdirSync(roh, { recursive: true });

  // Aufklaren: der Sturm rückwärts.
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    "-i", `assets/sturm-${s.name}.mp4`,
    "-vf", `reverse,fps=${BILDRATE}`,
    "-an", join(roh, "a%04d.png"),
  ]);
  // Der Schwenk, vorwärts.
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    "-i", `assets/schwenk-${s.name}.mp4`,
    "-vf", `fps=${BILDRATE}`,
    "-an", join(roh, "c%04d.png"),
  ]);

  // Der Halt: das letzte Bild des Aufklarens, so oft wiederholt, wie 900 ms
  // Bilder sind. Kopiert wird die Datei, nicht der Inhalt neu kodiert.
  const { readdirSync, copyFileSync } = await import("node:fs");
  const a = readdirSync(roh).filter((n) => n.startsWith("a")).sort();
  const c = readdirSync(roh).filter((n) => n.startsWith("c")).sort();
  const haltZahl = Math.round((HALT_MS / 1000) * BILDRATE);
  for (let i = 0; i < haltZahl; i++) {
    copyFileSync(join(roh, a.at(-1)), join(roh, `b${String(i + 1).padStart(4, "0")}.png`));
  }

  // Alles in eine durchlaufende Nummerierung.
  const alle = [...a, ...Array.from({ length: haltZahl }, (_, i) => `b${String(i + 1).padStart(4, "0")}.png`), ...c];
  const { renameSync } = await import("node:fs");
  alle.forEach((n, i) => renameSync(join(roh, n), join(roh, `z${String(i + 1).padStart(4, "0")}.png`)));

  /*
   * ZWEI FASSUNGEN, UND BEIDE WERDEN GEBRAUCHT.
   *
   * VP9 in WebM ist rund ein Drittel leichter als H.264 bei gleicher Güte und
   * wird von Chrome, Edge und Firefox genommen. Safari und iOS nehmen H.264 —
   * dort ist WebM erst ab Version 16 und auch dann nicht überall. Das
   * `<video>`-Element bekommt beide und sucht sich seine aus.
   *
   * Es ist außerdem die einzige Fassung, die der Prüfstand abspielen kann: das
   * Chromium, das Playwright mitbringt, ist der quelloffene Bau OHNE H.264.
   * Eine Seite, die sich im Prüfstand nicht ansehen lässt, ist nach dem einen
   * Gesetz nicht geprüft.
   */
  const dateien = [];
  const mp4 = join(ziel, `prolog-${s.name}.mp4`);
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-framerate", String(BILDRATE), "-i", join(roh, "z%04d.png"),
    "-vf", `scale=${s.breite}:${s.hoehe}`,
    "-c:v", "libx264", "-crf", String(GUETE), "-preset", "slow",
    "-pix_fmt", "yuv420p", "-profile:v", "main",
    // `faststart`: der Kopf des Films steht vorn, damit der Dekoder nicht
    // erst die ganze Datei braucht, um das erste Bild zu zeigen.
    "-movflags", "+faststart",
    "-an", mp4,
  ]);
  dateien.push(mp4);

  const webm = join(ziel, `prolog-${s.name}.webm`);
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-framerate", String(BILDRATE), "-i", join(roh, "z%04d.png"),
    "-vf", `scale=${s.breite}:${s.hoehe}`,
    "-c:v", "libvpx-vp9", "-crf", String(GUETE + 10), "-b:v", "0",
    "-row-mt", "1", "-deadline", "good", "-cpu-used", "2",
    "-pix_fmt", "yuv420p", "-an", webm,
  ]);
  dateien.push(webm);
  rmSync(roh, { recursive: true, force: true });

  console.log(
    `prolog-${s.name}  ${alle.length} Bilder à ${BILDRATE}/s = ${(alle.length / BILDRATE).toFixed(2)} s`
    + `  ·  Aufklaren ${a.length} / Halt ${haltZahl} / Schwenk ${c.length}`,
  );
  for (const d of dateien) {
    const kb = statSync(d).size / 1024;
    console.log(`${"".padEnd(12)}${d.split("/").pop().padEnd(22)} ${(kb / 1024).toFixed(2)} MB`
      + `  ·  1,6 Mbit/s ${(kb * 8 / 1024 / 1.6).toFixed(1)} s`);
  }
}
