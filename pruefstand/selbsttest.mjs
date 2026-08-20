/**
 * Der Selbsttest der Landing.
 *
 *   node pruefstand/selbsttest.mjs <ordner>
 *
 * Fährt beide Zielformate ab, hält bei 0 / 25 / 50 / 75 / 100 % Scrolltiefe
 * an, legt je eine Aufnahme ab und misst, was sich messen lässt.
 *
 * WARUM DAS NICHT DER PRÜFSTAND IST: der misst die Seite gegen die
 * ZERA-Kontrollen — ob sie trägt. Dieser hier misst die BEWEGUNG: ob der Film
 * durchgehend läuft, ob die Wortmarke im Bild steht, ob der Hinweis am Ende
 * fort ist. Zwei Fragen, zwei Geräte.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASIS = process.env.SELBSTTEST_ADRESSE ?? "http://127.0.0.1:4173/";
const ORDNER = process.argv[2] ?? "pruefstand/artefakte/selbsttest";
const TIEFEN = [0, 0.25, 0.50, 0.75, 1.0];
const FORMATE = [
  { name: "390x844", breite: 390, hoehe: 844 },
  { name: "1440x900", breite: 1440, hoehe: 900 },
];

mkdirSync(ORDNER, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });
const zeile = (...a) => console.log(...a);
let gefallen = 0;
const fehlt = (t) => { console.log("   ✗", t); gefallen++; };
const passt = (t) => console.log("   ✓", t);

/**
 * Ein grober Fingerabdruck dessen, was gerade auf dem Canvas steht.
 *
 * Gemessen an den Bildpunkten, nicht am DOM: ein Canvas mit `role="img"`
 * beweist nichts über seinen Inhalt. Der Abdruck dient zwei Fragen zugleich —
 * ist überhaupt Bild da (viele verschiedene Farbwerte), und ist es ein
 * ANDERES Bild als eben (anderer Abdruck).
 */
async function abdruck(page) {
  return page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return { da: false };
    const ctx = c.getContext("2d");
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const gesehen = new Set();
    let summe = 0;
    const schritt = Math.max(4, Math.floor(d.length / 4 / 4000) * 4);
    for (let i = 0; i < d.length; i += schritt) {
      gesehen.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
      summe += d[i] * 7 + d[i + 1] * 13 + d[i + 2] * 17;
    }
    return { da: true, farben: gesehen.size, summe };
  });
}

for (const f of FORMATE) {
  zeile(`\n═════ ${f.name} ═════`);
  const page = await browser.newPage({
    viewport: { width: f.breite, height: f.hoehe },
    deviceScaleFactor: 2, locale: "de-DE",
  });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") fehler.push("konsole: " + m.text().slice(0, 200)); });

  await page.goto(BASIS, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelector('.ladeschirm[data-fertig="ja"]') !== null,
    null, { timeout: 60_000 },
  ).catch(() => zeile("   (Ladeschirm wurde nicht fertig)"));
  await page.waitForTimeout(2500);

  // Der Aufbau: genau eine Bühne, und nichts von dem, was der verworfene
  // Auftrag verlangte.
  const aufbau = await page.evaluate(() => ({
    buehnen: document.querySelectorAll(".buehne").length,
    canvas: document.querySelectorAll("canvas").length,
    karten: document.querySelectorAll(".karte").length,
    ring: document.querySelectorAll(".ring").length,
    abspann: document.querySelectorAll("footer, .abspann").length,
    kapitel: document.querySelectorAll(".kolumnentitel").length,
    textknoten: document.querySelectorAll(".wortmarke, .hinweis, .siegel").length,
  }));
  zeile(`   Bühnen ${aufbau.buehnen} · Canvas ${aufbau.canvas} · Textelemente ${aufbau.textknoten}`);
  zeile(`   Karten ${aufbau.karten} · Fortschrittsring ${aufbau.ring} · Abspann ${aufbau.abspann} · Kapiteltitel ${aufbau.kapitel}`);
  aufbau.buehnen === 1 ? passt("genau eine Bühne") : fehlt(`${aufbau.buehnen} Bühnen`);
  const zuviel = aufbau.karten + aufbau.ring + aufbau.abspann + aufbau.kapitel;
  zuviel === 0 ? passt("keine Karte, kein Ring, kein Abspann, kein Kapiteltitel")
    : fehlt(`${zuviel} Element(e), die nicht gebaut werden sollten`);

  // Wortmarke: Größe UND vollständig im Bild.
  const marke = await page.evaluate(() => {
    const el = document.querySelector(".wortmarke");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      vw: parseFloat(getComputedStyle(el).fontSize) / window.innerWidth * 100,
      px: parseFloat(getComputedStyle(el).fontSize),
      label: el.getAttribute("aria-label"),
      oben: Math.round(r.top), unten: Math.round(r.bottom),
      hoehe: window.innerHeight,
      breiteAnteil: r.width / window.innerWidth * 100,
    };
  });
  zeile(`   Wortmarke ${marke.px.toFixed(0)} px = ${marke.vw.toFixed(1)} vw`
    + ` · Kasten ${marke.oben}…${marke.unten} von ${marke.hoehe} px`
    + ` · ${marke.breiteAnteil.toFixed(0)} % Fensterbreite · aria-label ${JSON.stringify(marke.label)}`);
  marke.vw >= 13 ? passt("Wortmarke ≥ 13 vw") : fehlt(`Wortmarke nur ${marke.vw.toFixed(1)} vw`);
  (marke.oben >= 0 && marke.unten <= marke.hoehe)
    ? passt("Wortmarke vollständig im Bild")
    : fehlt(`Wortmarke ragt aus dem Bild (${marke.oben}…${marke.unten} von ${marke.hoehe})`);

  const hoehe = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  const abdruecke = [];
  for (const [i, t] of TIEFEN.entries()) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(hoehe * t));
    await page.waitForTimeout(1500);
    const a = await abdruck(page);
    abdruecke.push(a);
    const sicht = await page.evaluate(() => ({
      hinweis: +getComputedStyle(document.querySelector(".hinweis")).opacity,
      marke: +getComputedStyle(document.querySelector(".wortmarke").parentElement).opacity,
      siegel: +getComputedStyle(document.querySelector(".siegel")).opacity,
    }));
    await page.screenshot({ path: `${ORDNER}/${f.name}-${String(Math.round(t * 100)).padStart(3, "0")}.png` });
    zeile(`   ${String(Math.round(t * 100)).padStart(3)} %  ${a.da ? a.farben + " Farbwerte" : "KEIN CANVAS"}`
      + ` · Hinweis ${sicht.hinweis.toFixed(2)} · Marke ${sicht.marke.toFixed(2)} · Siegel ${sicht.siegel.toFixed(2)}`);
    if (a.da && a.farben < 40) fehlt(`bei ${Math.round(t * 100)} % zeigt der Canvas fast nichts`);
    if (i === TIEFEN.length - 1) {
      sicht.hinweis < 0.02 ? passt("„Scrollen“ am Seitenende nicht mehr sichtbar")
        : fehlt(`„Scrollen“ am Seitenende noch bei Deckkraft ${sicht.hinweis}`);
      sicht.siegel > 0.98 ? passt("Siegel am Seitenende vollständig da")
        : fehlt(`Siegel am Seitenende nur bei ${sicht.siegel}`);
    }
  }

  // Drei verschiedene Frames bei 25 / 50 / 75 %.
  const drei = [abdruecke[1], abdruecke[2], abdruecke[3]].map((a) => a.summe);
  const verschieden = new Set(drei).size;
  verschieden === 3
    ? passt(`bei 25/50/75 % drei verschiedene Frames (${drei.map((x) => x % 100000).join(" · ")})`)
    : fehlt(`bei 25/50/75 % nur ${verschieden} verschiedene Frames`);

  /*
   * Der Ausschnitt: wie viel schneidet `cover` weg, und wie weit wird
   * hochskaliert?
   *
   * Beides sind Aussagen über das ASSET, nicht über den Code — eine 3:4-
   * Aufnahme kann ein 9:19,5-Telefon nicht ohne Schnitt füllen, und eine
   * 420 px breite Sequenz kann 1440 px nicht ohne Vergrößerung füllen. Die
   * Zahlen gehören in den Bericht, damit über den Querformatsatz mit Zahlen
   * entschieden wird und nicht nach Gefühl.
   */
  const schnitt = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const bild = { b: 420, h: 562 };   // Maße der Sequenz, siehe scripts/sequenz-bauen.mjs
    const s = Math.max(c.clientWidth / bild.b, c.clientHeight / bild.h);
    return {
      massstab: s,
      wegBreite: 1 - c.clientWidth / (bild.b * s),
      wegHoehe: 1 - c.clientHeight / (bild.h * s),
    };
  });
  zeile(`   Ausschnitt: ${schnitt.massstab.toFixed(2)}× vergrößert`
    + ` · ${(schnitt.wegBreite * 100).toFixed(0)} % der Breite`
    + ` und ${(schnitt.wegHoehe * 100).toFixed(0)} % der Höhe fallen weg`);

  /*
   * Der Kontrast der Siegeltexte gegen das, was hinter ihnen steht.
   *
   * Gemessen am Bildpunkt, nicht an einer CSS-Farbe: hinter dem Siegel liegt
   * eine Fotografie mit einer Abdunklung darüber, und was davon ankommt,
   * weiß nur die Aufnahme. Der Text wird kurz unsichtbar gemacht, der Grund
   * fotografiert, dann zurückgestellt — dieselbe Technik wie in
   * `pruefstand/messen.ts`.
   */
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(hoehe));
  await page.waitForTimeout(1500);
  const felder = await page.evaluate(() => {
    const raus = [];
    for (const el of document.querySelectorAll(".siegel p")) {
      const r = el.getBoundingClientRect();
      raus.push({
        text: el.textContent.slice(0, 22), farbe: getComputedStyle(el).color,
        groesse: parseFloat(getComputedStyle(el).fontSize),
        gewicht: parseInt(getComputedStyle(el).fontWeight, 10) || 400,
        x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)),
        b: Math.max(1, Math.ceil(r.width)), h: Math.max(1, Math.ceil(r.height)),
      });
    }
    return raus;
  });
  await page.evaluate(() => document.querySelectorAll(".siegel p")
    .forEach((el) => { el.style.visibility = "hidden"; }));
  await page.waitForTimeout(200);
  for (const f of felder) {
    const bild = await page.screenshot({ clip: { x: f.x, y: f.y, width: f.b, height: f.h } });
    const { hellste } = await page.evaluate(async (b64) => {
      const bild = new Image();
      await new Promise((ok) => { bild.onload = ok; bild.src = "data:image/png;base64," + b64; });
      const c = document.createElement("canvas");
      c.width = bild.width; c.height = bild.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(bild, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const kanal = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      let max = -1, farbe = null;
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.2126 * kanal(d[i]) + 0.7152 * kanal(d[i + 1]) + 0.0722 * kanal(d[i + 2]);
        if (l > max) { max = l; farbe = [d[i], d[i + 1], d[i + 2]]; }
      }
      return { hellste: { l: max, farbe } };
    }, bild.toString("base64"));
    const [r, g, bl] = f.farbe.match(/\d+/g).map(Number);
    const kanal = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const lt = 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(bl);
    const [hell, dunkel] = lt >= hellste.l ? [lt, hellste.l] : [hellste.l, lt];
    const wert = (hell + 0.05) / (dunkel + 0.05);
    const gross = f.groesse >= 24 || (f.gewicht >= 700 && f.groesse >= 18.66);
    const soll = gross ? 3 : 4.5;
    const satz = `„${f.text}" ${f.groesse.toFixed(0)}px → ${wert.toFixed(2)}:1 gegen hellsten Grund rgb(${hellste.farbe.join(",")}), soll ${soll}`;
    wert >= soll ? passt(satz) : fehlt(satz);
  }
  await page.evaluate(() => document.querySelectorAll(".siegel p")
    .forEach((el) => { el.style.visibility = ""; }));

  fehler.length === 0 ? passt("0 JS-Fehler") : fehlt(`${fehler.length} JS-Fehler: ${fehler.slice(0, 3).join(" | ")}`);
  await page.close();
}

/* ————————————————————————— Ruhemodus ————————————————————————— */
zeile("\n═════ RUHEMODUS (prefers-reduced-motion) ═════");
{
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    reducedMotion: "reduce", locale: "de-DE",
  });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(e.message.slice(0, 200)));
  await page.goto(BASIS, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const z = await page.evaluate(() => {
    const bild = document.querySelector(".ebene-bild");
    return {
      canvas: document.querySelectorAll("canvas").length,
      ladeschirm: document.querySelectorAll(".ladeschirm").length,
      standbild: bild?.tagName.toLowerCase(),
      quelle: bild?.getAttribute("src")?.split("/").pop(),
      geladen: bild?.complete && bild?.naturalWidth > 0,
      marke: +getComputedStyle(document.querySelector(".wortmarke")).opacity,
      markeSichtbar: getComputedStyle(document.querySelector(".wortmarke")).display !== "none",
      siegel: +getComputedStyle(document.querySelector(".siegel")).opacity,
      hoehe: document.body.scrollHeight,
      fenster: window.innerHeight,
    };
  });
  zeile(`   Canvas ${z.canvas} (soll 0) · Ladeschirm ${z.ladeschirm} (soll 0)`);
  zeile(`   Standbild <${z.standbild}> ${z.quelle} · geladen: ${z.geladen}`);
  zeile(`   Wortmarke sichtbar ${z.markeSichtbar}, Deckkraft ${z.marke} · Siegel ${z.siegel}`);
  zeile(`   Seitenhöhe ${z.hoehe} px bei ${z.fenster} px = ${(z.hoehe / z.fenster).toFixed(1)} Bildschirme`);
  z.canvas === 0 ? passt("keine Sequenz") : fehlt(`${z.canvas} Canvas trotz Ruhemodus`);
  z.geladen ? passt(`letzter Frame als Standbild (${z.quelle})`) : fehlt("Standbild nicht geladen");
  (z.markeSichtbar && z.marke > 0.98) ? passt("Wortmarke sofort sichtbar") : fehlt("Wortmarke nicht sichtbar");
  z.siegel > 0.98 ? passt("Siegel sofort sichtbar") : fehlt("Siegel nicht sichtbar");
  (z.hoehe / z.fenster) < 1.2 ? passt("Seite normal hoch") : fehlt(`${(z.hoehe / z.fenster).toFixed(1)} Bildschirme im Ruhemodus`);
  await page.screenshot({ path: `${ORDNER}/ruhe-390x844.png`, fullPage: true });
  fehler.length === 0 ? passt("0 JS-Fehler") : fehlt(`${fehler.length} JS-Fehler: ${fehler[0]}`);
  await page.close();
}

/* ————————————— Ladezeit unter Drosselung ————————————— */
zeile("\n═════ SEQUENZ UNTER DROSSELUNG ═════");
for (const netz of [{ name: "Slow 4G (Lighthouse)", mbit: 1.6, rtt: 150 }, { name: "LTE, typisch", mbit: 10, rtt: 70 }]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
  const s = await page.context().newCDPSession(page);
  await s.send("Network.enable");
  await s.send("Network.emulateNetworkConditions", {
    offline: false, latency: netz.rtt,
    downloadThroughput: netz.mbit * 1024 * 1024 / 8,
    uploadThroughput: 750 * 1024 / 8,
  });
  let bytes = 0, frames = 0;
  page.on("response", async (r) => {
    if (!/\/seq\//.test(r.url())) return;
    frames++;
    bytes += Number(r.headers()["content-length"] ?? 0)
      || (await r.body().catch(() => Buffer.alloc(0))).length;
  });
  const start = Date.now();
  await page.goto(BASIS, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelector('.ladeschirm[data-fertig="ja"]') !== null,
    null, { timeout: 90_000 },
  ).catch(() => zeile("   (Freigabe kam nicht)"));
  const dauer = (Date.now() - start) / 1000;
  const kb = bytes / 1024;
  zeile(`   ${netz.name.padEnd(21)} ${frames} Frames · ${kb.toFixed(0)} kB · ${dauer.toFixed(1)} s bis zur Freigabe`);
  if (netz.mbit === 1.6) {
    kb <= 780 ? passt("Sequenz ≤ 780 kB") : fehlt(`Sequenz ${kb.toFixed(0)} kB`);
    dauer < 4 ? passt("Freigabe unter 4 s bei 1,6 Mbit/s") : fehlt(`Freigabe erst nach ${dauer.toFixed(1)} s bei 1,6 Mbit/s`);
  }
  await page.close();
}

await browser.close();
zeile(gefallen === 0 ? "\nAlles bestanden." : `\n${gefallen} Punkt(e) gefallen.`);
process.exit(gefallen > 0 ? 1 : 0);
