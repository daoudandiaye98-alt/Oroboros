/**
 * Erzeugt die sechs Bildsequenzen aus den sechs Quellfilmen.
 *
 *   node scripts/sequenzen-bauen.mjs
 *
 * Läuft NICHT im Vercel-Build. Die fertigen Frames liegen unter
 * `public/seq/` im Repo, damit die Auslieferung kein ffmpeg braucht. Dieses
 * Skript ist der Weg, sie zu erneuern — nicht der Weg, sie auszuliefern.
 *
 * WARUM DAS EINROLLEN RÜCKWÄRTS LÄUFT: Die Vorwärts-Generierung des Einrollens
 * rotierte das Tier — Kopf und Schwanzspitze tauschten die Plätze. Das
 * AUFROLLEN mit fixiertem Kopf, rückwärts abgespielt, ergibt ein sauberes
 * Einrollen. Der Kopf steht dann im ersten UND im letzten Frame auf zwölf Uhr.
 * `reverse` nicht entfernen, Reihenfolge nicht ändern.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

/** 12 Bilder je Sekunde. Bei Scroll-Bindung trägt das — die Weichheit kommt
 *  aus dem Nachzug der Rollposition, nicht aus der Bildrate. */
const BILDRATE = 12;

/** WebP-Qualität. 62 laut Bauauftrag. */
const GUETE = 62;

/**
 * Die Breiten.
 *
 * ABWEICHUNG vom Bauauftrag, bewusst und gemessen: dort stehen 900 (hoch) und
 * 1600 (quer). Die Quellfilme sind aber 828 bzw. 1284 breit. Auf 900/1600 zu
 * skalieren hieße, um 9 % bzw. 25 % über die vorhandene Auflösung hinaus zu
 * vergrößern — das kostet Bytes und liefert kein einziges zusätzliches Detail.
 * Skaliert wird deshalb auf die native Breite der Quelle. Wer die Sequenz
 * größer braucht, braucht größere Quellen, nicht größere Zahlen.
 */
const SAETZE = [
  { kuerzel: "p", ordner: "hoch", breite: 828 },
  { kuerzel: "l", ordner: "quer", breite: 1284 },
];

const SEQUENZEN = [
  { name: "coil", quelle: "einroll-quelle.mp4", rueckwaerts: true },
  { name: "trav", quelle: "traverse-quelle.mp4", rueckwaerts: false },
  { name: "head", quelle: "kopf-quelle.mp4", rueckwaerts: false },
];

const WURZEL = "public/seq";

/**
 * Die vier Standbilder, in beiden Formaten.
 *
 * Sie tragen den ersten Bildschirm, bevor eine Sequenz überhaupt geladen ist,
 * und sie sind der gesamte Inhalt im Ruhemodus. Ausgeliefert als WebP über
 * `<picture>` mit `media="(orientation: portrait)"` — damit sitzt schon der
 * erste Frame im richtigen Ausschnitt und nicht erst der Sequenzstart.
 */
const STANDBILDER = ["hero", "trav", "coil", "ring"];

mkdirSync("public/still", { recursive: true });
for (const satz of SAETZE) {
  for (const name of STANDBILDER) {
    const nach = `public/still/${name}-${satz.kuerzel}.webp`;
    await sharp(join("assets", satz.ordner, `${name}.png`))
      .resize({ width: satz.breite })
      .webp({ quality: 72 })
      .toFile(nach);
    console.log(`still ${name}-${satz.kuerzel}`.padEnd(18),
      `${String(Math.round(statSync(nach).size / 1024)).padStart(4)} kB`);
  }
}

for (const satz of SAETZE) {
  for (const seq of SEQUENZEN) {
    const ziel = join(WURZEL, `${seq.name}-${satz.kuerzel}`);
    rmSync(ziel, { recursive: true, force: true });
    mkdirSync(ziel, { recursive: true });

    const filter = [
      `fps=${BILDRATE}`,
      `scale=${satz.breite}:-2`,
      seq.rueckwaerts ? "reverse" : null,
    ].filter(Boolean).join(",");

    execFileSync(ffmpeg, [
      "-hide_banner", "-loglevel", "error",
      "-i", join("assets", satz.ordner, seq.quelle),
      "-vf", filter,
      join(ziel, "f%03d.png"),
    ]);

    // PNG → WebP, danach das PNG weg. Ausgeliefert wird nur WebP.
    const pngs = readdirSync(ziel).filter((n) => n.endsWith(".png")).sort();
    let bytes = 0;
    for (const png of pngs) {
      const von = join(ziel, png);
      const nach = von.replace(/\.png$/, ".webp");
      await sharp(von).webp({ quality: GUETE }).toFile(nach);
      unlinkSync(von);
      bytes += statSync(nach).size;
    }
    const kb = Math.round(bytes / 1024);
    console.log(
      `${seq.name}-${satz.kuerzel}`.padEnd(9),
      `${String(pngs.length).padStart(3)} Frames`,
      `${String(kb).padStart(5)} kB gesamt`,
      `${String(Math.round(bytes / pngs.length / 1024)).padStart(3)} kB je Frame`,
      seq.rueckwaerts ? "· rückwärts" : "",
    );
  }
}
