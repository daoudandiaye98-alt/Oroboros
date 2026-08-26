/**
 * Die benannten Aufnahmen der Phase 2.
 *
 *   node pruefstand/aufnahmen.mjs [ordner]
 *
 * Sieben Stellen je Ansichtsgröße, plus der ruhige Pfad. Sie sind kein Test —
 * sie sind der BELEG, den der Bauauftrag verlangt: jede Behauptung des
 * Berichts hat hier ein Bild, das man ansehen kann.
 *
 * Zwei davon hängen an einer Zeitachse (die Ladeszene), fünf an einer
 * Rollposition. Deshalb läuft die Ladeszene in einem eigenen Durchgang: wer
 * sie abwartet, um danach zu scrollen, kann sie nicht mehr fotografieren.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { buehnenweg, rolleAufBuehne, warteAufBuehne } from "./buehne.mjs";

const BASIS = process.env.SELBSTTEST_ADRESSE ?? "http://127.0.0.1:4173/";
const ORDNER = process.argv[2] ?? "pruefstand/artefakte/phase2";
const ANSICHTEN = [
  { name: "390", breite: 390, hoehe: 844 },
  { name: "1440", breite: 1440, hoehe: 900 },
];

/** Die fünf rollgebundenen Stellen, mit dem, was an ihnen zu sehen sein soll. */
const STELLEN = [
  { name: "3-hero", p: 0, was: "Wortmarke und Rollhinweis über dem ersten Frame" },
  { name: "4-film", p: 0.5, was: "mitten im Film" },
  { name: "5-filmende", p: 0.79, was: "letzter Frame, bevor die Verwandlung beginnt" },
  { name: "6-lockup-halb", p: 0.87, was: "Ausschnitt auf halbem Weg zum Buchstaben" },
  { name: "7-lockup", p: 1, was: "der Ring IST das erste O" },
];

/** Die beiden Stellen der Ladeszene, in Millisekunden nach dem Aufruf. */
const ZEITEN = [
  { name: "1-zug", ms: 1100, was: "der Ouroboros schreibt sich" },
  { name: "2-staub", ms: 2400, was: "die Linie zerfällt zu Staub" },
];

mkdirSync(ORDNER, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });

for (const a of ANSICHTEN) {
  /* ————— Durchgang eins: die Ladeszene, nach der Uhr ————— */
  {
    const seite = await browser.newPage({ viewport: { width: a.breite, height: a.hoehe } });
    const auf = Date.now();
    await seite.goto(BASIS, { waitUntil: "domcontentloaded" });
    for (const z of ZEITEN) {
      const warten = z.ms - (Date.now() - auf);
      if (warten > 0) await seite.waitForTimeout(warten);
      await seite.screenshot({ path: `${ORDNER}/${a.name}-${z.name}.png` });
      console.log(`${a.name}  ${z.name.padEnd(14)} ${z.was}`);
    }
    await seite.close();
  }

  /* ————— Durchgang zwei: der Film, nach der Rollposition ————— */
  {
    const seite = await browser.newPage({ viewport: { width: a.breite, height: a.hoehe } });
    await seite.goto(BASIS, { waitUntil: "networkidle" });
    await warteAufBuehne(seite);
    await seite.waitForTimeout(2500);
    // Gegen die BÜHNE, nicht gegen die Seite — siehe `pruefstand/buehne.mjs`.
    const masse = await buehnenweg(seite);
    for (const s of STELLEN) {
      await rolleAufBuehne(seite, masse, s.p);
      /* 2,6 s, nicht 0,9: der Auftritt der sieben Buchstaben dauert 820 ms plus
         sechsmal 55 ms Versatz, und der geglättete Fortschritt läuft nach. Wer
         früher auslöst, fotografiert eine halb eingefahrene Zeile. */
      await seite.waitForTimeout(2600);
      await seite.screenshot({ path: `${ORDNER}/${a.name}-${s.name}.png` });
      console.log(`${a.name}  ${s.name.padEnd(14)} ${s.was}`);
    }
    await seite.close();
  }
}

/* ————— Der ruhige Pfad ————— */
for (const a of ANSICHTEN) {
  const seite = await browser.newPage({
    viewport: { width: a.breite, height: a.hoehe }, reducedMotion: "reduce",
  });
  await seite.goto(BASIS, { waitUntil: "networkidle" });
  await seite.waitForTimeout(2500);
  await seite.screenshot({ path: `${ORDNER}/${a.name}-8-ruhig.png` });
  console.log(`${a.name}  8-ruhig        ohne Bewegung: ein Bildschirm, letzter Frame`);
  await seite.close();
}

await browser.close();
