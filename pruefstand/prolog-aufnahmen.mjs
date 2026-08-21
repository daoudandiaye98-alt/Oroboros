/**
 * Acht benannte Aufnahmen je Ansicht — die aus §7.
 *
 *   node pruefstand/prolog-aufnahmen.mjs [port]
 *
 * Aufgenommen wird an ZUSTÄNDEN, nicht an Uhrzeiten: „Erosion 50 %" ist der
 * Moment, in dem die Front bei 0,5 steht, und nicht 1200 ms nach dem Laden.
 * Eine Uhrzeit misst die Maschine mit, auf der sie läuft.
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 4178);
const URL = `http://127.0.0.1:${PORT}/`;
const AUS = "pruefstand/artefakte/prolog";
const ANSICHTEN = [
  { name: "390x844", width: 390, height: 844, dpr: 3 },
  { name: "1440x900", width: 1440, height: 900, dpr: 2 },
];

rmSync(AUS, { recursive: true, force: true });
mkdirSync(AUS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });

for (const a of ANSICHTEN) {
  const ctx = await browser.newContext({
    viewport: { width: a.width, height: a.height },
    deviceScaleFactor: a.dpr,
  });
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  seite.on("requestfailed", (r) => fehler.push(`NETZ ${r.url()}`));

  const schuss = async (n, name) => {
    await seite.screenshot({ path: `${AUS}/${a.name}-${n}-${name}.png` });
  };
  const wartenAuf = async (was, fn, arg, ms = 20000) => {
    try { await seite.waitForFunction(fn, arg, { timeout: ms, polling: 30 }); }
    catch { console.log(`   ! ${a.name}: „${was}" nicht erreicht`); }
  };

  await seite.goto(URL, { waitUntil: "domcontentloaded" });

  // 1 — der Satz steht vollständig
  await wartenAuf("Satz steht", () => (window.__prolog?.front ?? 0) >= 0.98);
  await schuss(1, "satz");

  // 2 — Erosion bei 50 %
  await wartenAuf("Erosion 50 %", () => window.__prolog?.phase === "erosion" && window.__prolog.front >= 0.5);
  await schuss(2, "erosion50");

  // 3 — der Sturm, blind
  await wartenAuf("Sturm blind", () => {
    const v = document.querySelector("video");
    return v && !v.paused && v.currentTime > 0.15;
  });
  await schuss(3, "sturm-blind");

  // 4 — das Tier freigelegt, im Halt
  await wartenAuf("Tier frei", () => {
    const v = document.querySelector("video");
    return v && v.currentTime >= 5.35;
  });
  await schuss(4, "tier");

  // 5 — Mitte des Schwenks
  await wartenAuf("Schwenkmitte", () => {
    const v = document.querySelector("video");
    return v && v.currentTime >= 8.4;
  });
  await schuss(5, "schwenk");

  // 6 — der Heldenbeginn: der Prolog ist fort
  await wartenAuf("Übergabe", () => !document.querySelector(".prolog"), null, 45000);
  await seite.waitForTimeout(500);
  await schuss(6, "held-anfang");

  // 7 — die Hälfte der Bühne
  const hoehe = await seite.evaluate(() => document.querySelector(".buehne").offsetHeight - window.innerHeight);
  await seite.evaluate((y) => window.scrollTo(0, y), Math.round(hoehe * 0.5));
  await seite.waitForTimeout(700);
  await schuss(7, "mitte");

  // 8 — das Schlussbild
  await seite.evaluate((y) => window.scrollTo(0, y), hoehe);
  await seite.waitForTimeout(1600);
  await schuss(8, "lockup");

  const aufbau = await seite.getAttribute("canvas.ebene-bild", "data-aufbau");
  console.log(`${a.name}  Aufbau ${aufbau}`);
  console.log(`${a.name}  Fehler ${fehler.length}${fehler.length ? " — " + fehler.slice(0, 3).join(" | ") : ""}`);
  await ctx.close();
}
await browser.close();
console.log(`Aufnahmen in ${AUS}`);
