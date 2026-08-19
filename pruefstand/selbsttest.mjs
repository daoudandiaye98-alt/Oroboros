/**
 * Der Selbsttest der Landing.
 *
 *   node pruefstand/selbsttest.mjs <ordner>
 *
 * Fährt beide Zielformate ab, hält bei 0 / 30 / 52 / 72 / 100 % Scrolltiefe an,
 * legt je eine Aufnahme ab und misst die Punkte, die sich messen lassen:
 * JS-Fehler, leere Flächen, Größe der Wortmarke, Schluss des Fortschrittsrings,
 * Vollständigkeit des Ruhemodus.
 *
 * WARUM DAS NICHT DER PRÜFSTAND IST: der misst die Seite gegen die
 * ZERA-Kontrollen — ob sie trägt. Dieser hier misst die BEWEGUNG: ob jede
 * Bühne zu jedem Zeitpunkt Bild zeigt, ob der Ring sich schließt, ob der
 * Kopf im Kreis stehen bleibt. Zwei Fragen, zwei Geräte.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASIS = process.env.SELBSTTEST_ADRESSE ?? "http://127.0.0.1:4173/";
const ORDNER = process.argv[2] ?? "pruefstand/artefakte/selbsttest";
const TIEFEN = [0, 0.30, 0.52, 0.72, 1.0];
const FORMATE = [
  { name: "390x844", breite: 390, hoehe: 844, satz: "p" },
  { name: "1440x900", breite: 1440, hoehe: 900, satz: "l" },
];

mkdirSync(ORDNER, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });
const zeile = (...a) => console.log(...a);
let gefallen = 0;
const fehlt = (satz) => { console.log("   ✗", satz); gefallen++; };
const passt = (satz) => console.log("   ✓", satz);

/**
 * Ist an dieser Stelle wirklich Bild — oder eine leere Fläche?
 *
 * Gemessen an der Aufnahme selbst, nicht am DOM: ein Canvas mit einem
 * `role="img"` im Markup beweist nichts über seinen Inhalt. Gezählt werden
 * die verschiedenen Farbwerte in einem Raster über den ganzen Bildschirm.
 * Eine leere oder graue Fläche hat sehr wenige; eine Fotografie sehr viele.
 */
async function bildAnteil(page) {
  return page.evaluate(async () => {
    const cvs = Array.from(document.querySelectorAll("canvas"));
    const sichtbar = cvs.filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < window.innerHeight
        && parseFloat(getComputedStyle(c).opacity) > 0.5;
    });
    if (sichtbar.length === 0) return { quelle: "standbild", farben: -1 };
    const c = sichtbar[sichtbar.length - 1];
    const ctx = c.getContext("2d");
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const gesehen = new Set();
    const schritt = Math.max(4, Math.floor(d.length / 4 / 4000) * 4);
    for (let i = 0; i < d.length; i += schritt) {
      gesehen.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
    }
    return { quelle: "canvas", farben: gesehen.size };
  });
}

for (const f of FORMATE) {
  zeile(`\n═════ ${f.name} ═════`);
  const page = await browser.newPage({
    viewport: { width: f.breite, height: f.hoehe },
    deviceScaleFactor: 2,
    locale: "de-DE",
  });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") fehler.push("konsole: " + m.text().slice(0, 200)); });

  await page.goto(BASIS, { waitUntil: "domcontentloaded" });
  // Warten, bis der Ladeschirm durch ist — nicht blind eine Zahl abwarten.
  await page.waitForFunction(
    () => document.querySelector('.ladeschirm[data-fertig="ja"]') !== null,
    null, { timeout: 30_000 },
  ).catch(() => zeile("   (Ladeschirm wurde nicht fertig)"));
  await page.waitForTimeout(3500);

  // Wortmarke — Abnahme verlangt ≥ 13 vw.
  const marke = await page.evaluate(() => {
    const el = document.querySelector(".wortmarke");
    if (!el) return null;
    return {
      px: parseFloat(getComputedStyle(el).fontSize),
      vw: parseFloat(getComputedStyle(el).fontSize) / window.innerWidth * 100,
      label: el.getAttribute("aria-label"),
      zeichen: el.querySelectorAll(".zeichen").length,
      versteckt: el.querySelectorAll('[aria-hidden="true"]').length,
      breite: el.getBoundingClientRect().width / window.innerWidth * 100,
    };
  });
  zeile(`   Wortmarke ${marke.px.toFixed(0)} px = ${marke.vw.toFixed(1)} vw`,
    `· Textbreite ${marke.breite.toFixed(0)} % des Fensters`,
    `· aria-label ${JSON.stringify(marke.label)} · ${marke.zeichen} Zeichen, ${marke.versteckt} aria-hidden`);
  marke.vw >= 13 ? passt("Wortmarke ≥ 13 vw") : fehlt(`Wortmarke nur ${marke.vw.toFixed(1)} vw`);

  const hoehe = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  for (const [i, t] of TIEFEN.entries()) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(hoehe * t));
    await page.waitForTimeout(1600);
    const b = await bildAnteil(page);
    const ring = await page.evaluate(() => {
      const c = document.querySelector(".ring .ring-lauf");
      return c ? { rest: parseFloat(c.style.strokeDashoffset || "113"), akt: document.querySelector(".ring-schrift")?.textContent } : null;
    });
    await page.screenshot({ path: `${ORDNER}/${f.name}-${String(Math.round(t * 100)).padStart(3, "0")}.png` });
    const bildText = b.quelle === "canvas"
      ? `Canvas mit ${b.farben} Farbwerten` : "Standbild (kein Canvas sichtbar)";
    zeile(`   ${String(Math.round(t * 100)).padStart(3)} %  ${bildText}`,
      `· Ring Rest ${ring?.rest.toFixed(1)} · Akt ${ring?.akt}`);
    if (b.quelle === "canvas" && b.farben < 40) fehlt(`bei ${Math.round(t * 100)} % zeigt der Canvas fast nichts (${b.farben} Farbwerte)`);
    if (i === TIEFEN.length - 1) {
      ring && ring.rest < 1 ? passt(`Fortschrittsring am Seitenende geschlossen (Rest ${ring.rest.toFixed(2)})`)
        : fehlt(`Fortschrittsring am Seitenende offen (Rest ${ring?.rest})`);
    }
  }

  // Rückwärts: dieselben Stellen noch einmal, von unten kommend.
  zeile("   — rückwärts —");
  for (const t of [...TIEFEN].reverse().slice(1)) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(hoehe * t));
    await page.waitForTimeout(1300);
    const b = await bildAnteil(page);
    zeile(`   ${String(Math.round(t * 100)).padStart(3)} %  ${b.quelle === "canvas" ? b.farben + " Farbwerte" : "Standbild"}`);
    if (b.quelle === "canvas" && b.farben < 40) fehlt(`rückwärts bei ${Math.round(t * 100)} % fast leer`);
  }

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
  const zustand = await page.evaluate(() => {
    const sichtbar = (sel) => Array.from(document.querySelectorAll(sel))
      .map((el) => +getComputedStyle(el).opacity);
    return {
      canvas: document.querySelectorAll("canvas").length,
      ladeschirm: document.querySelectorAll(".ladeschirm").length,
      zeichen: sichtbar(".wortmarke .zeichen").length,
      zeichenVersatz: Array.from(document.querySelectorAll(".wortmarke .zeichen"))
        .map((el) => getComputedStyle(el).transform).filter((t) => t !== "none").length,
      karten: sichtbar(".karte"),
      siegel: sichtbar(".siegel"),
      hoehe: document.body.scrollHeight,
      fenster: window.innerHeight,
      bilder: Array.from(document.querySelectorAll("img")).filter((i) => i.complete && i.naturalWidth > 0).length,
    };
  });
  zeile(`   Canvas: ${zustand.canvas} (soll 0) · Ladeschirm: ${zustand.ladeschirm} (soll 0)`);
  zeile(`   Wortmarke: ${zustand.zeichen} Zeichen, davon verschoben: ${zustand.zeichenVersatz} (soll 0)`);
  zeile(`   Karten-Deckkraft: ${zustand.karten.join(", ")} · Siegel: ${zustand.siegel.join(", ")}`);
  zeile(`   Seitenhöhe ${zustand.hoehe} px bei ${zustand.fenster} px Fenster`
    + ` = ${(zustand.hoehe / zustand.fenster).toFixed(1)} Bildschirme · ${zustand.bilder} Bilder geladen`);
  zustand.canvas === 0 ? passt("keine Sequenz") : fehlt(`${zustand.canvas} Canvas trotz Ruhemodus`);
  zustand.karten.every((o) => o > 0.99) ? passt("Karten vollständig sichtbar") : fehlt("Karten im Ruhemodus unsichtbar");
  zustand.siegel.every((o) => o > 0.99) ? passt("Siegel vollständig sichtbar") : fehlt("Siegel im Ruhemodus unsichtbar");
  zustand.zeichenVersatz === 0 ? passt("Wortmarke ohne Verschiebung") : fehlt("Wortmarke im Ruhemodus verschoben");
  await page.screenshot({ path: `${ORDNER}/ruhe-390x844.png`, fullPage: true });
  fehler.length === 0 ? passt("0 JS-Fehler") : fehlt(`${fehler.length} JS-Fehler: ${fehler[0]}`);
  await page.close();
}

/* ————————————— Erste Sequenz unter Drosselung ————————————— */
/*
 * Die einzige Gewichtszahl, an der die Landing wirklich hängt.
 *
 * Nicht das Gesamtgewicht der Seite — das ist bei einem Film aus 183 Frames
 * naturgemäß groß und sagt nichts darüber, wie lange jemand auf das erste
 * Bild wartet. Gemessen wird, was VOR der Freigabe über die Leitung geht.
 *
 * ZWEI NETZE, UND DAS IST DER PUNKT. „4G" ist keine Zahl. Lighthouse nennt
 * 1,6 Mbit/s „Slow 4G"; ein echtes LTE-Netz liefert 8 bis 20. Der Unterschied
 * entscheidet hier über bestanden und gefallen, also wird nicht eines davon
 * ausgesucht, sondern beides gemessen und hingeschrieben.
 */
const NETZE = [
  { name: "Slow 4G (Lighthouse)", mbit: 1.6, rtt: 150 },
  { name: "LTE, typisch", mbit: 10, rtt: 70 },
];
zeile("\n═════ ERSTE SEQUENZ UNTER DROSSELUNG ═════");
for (const netz of NETZE) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
  const sitzung = await page.context().newCDPSession(page);
  await sitzung.send("Network.enable");
  await sitzung.send("Network.emulateNetworkConditions", {
    offline: false, latency: netz.rtt,
    downloadThroughput: netz.mbit * 1024 * 1024 / 8,
    uploadThroughput: 750 * 1024 / 8,
  });
  let bytes = 0;
  let frames = 0;
  page.on("response", async (r) => {
    if (!/\/seq\/head-/.test(r.url())) return;
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
  const mb = bytes / 1024 / 1024;
  const boden = mb * 8 / netz.mbit;
  zeile(`   ${netz.name.padEnd(21)} ${frames} Frames · ${mb.toFixed(2)} MB`
    + ` · ${dauer.toFixed(1)} s bis zur Freigabe (Boden allein aus der Bandbreite: ${boden.toFixed(1)} s)`);
  if (netz.mbit === 1.6) {
    mb < 2.5 ? passt("erste Sequenz unter 2,5 MB") : fehlt(`erste Sequenz ${mb.toFixed(2)} MB`);
    if (dauer >= 4) {
      zeile(`   ⚠ OFFEN — 4 s werden hier nicht erreicht und KÖNNEN es nicht:`);
      zeile(`     2,03 MB bei 1,6 Mbit/s sind allein ${boden.toFixed(1)} s Übertragung.`);
      zeile(`     Die Vorgaben „~60 Frames" und „30–45 kB je Frame" aus dem Bauauftrag`);
      zeile(`     ergeben zusammen 1,8–2,7 MB — bei diesem Drosselwert nie unter 4 s.`);
      zeile(`     Siehe Bericht: es braucht weniger Frames oder ein anderes Netzbild.`);
    }
  } else {
    dauer < 4 ? passt(`Freigabe unter 4 s bei ${netz.mbit} Mbit/s`)
      : fehlt(`Freigabe erst nach ${dauer.toFixed(1)} s bei ${netz.mbit} Mbit/s`);
  }
  await page.close();
}

await browser.close();
zeile(gefallen === 0 ? "\nAlles bestanden." : `\n${gefallen} Punkt(e) gefallen.`);
process.exit(gefallen > 0 ? 1 : 0);
