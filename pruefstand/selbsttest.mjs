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

/**
 * Kontrast eines Textes gegen das, was WIRKLICH hinter ihm steht.
 *
 * Gemessen am Bildpunkt, nicht an einer CSS-Farbe: hinter dem Text liegt eine
 * Fotografie, und was von ihr ankommt, weiß nur die Aufnahme. Der Text wird
 * kurz unsichtbar gemacht, der Grund fotografiert, dann zurückgestellt —
 * dieselbe Technik wie in `pruefstand/messen.ts`.
 *
 * Seit Phase 2 misst diese Funktion in beide Richtungen: bis dahin stand
 * heller Text auf abgedunkeltem Bild, jetzt dunkler auf hellem Sand. Der
 * hellste Grundpunkt ist für dunklen Text der schlechteste Fall — für hellen
 * wäre es der dunkelste. Beide Fälle stecken in derselben Formel, weil sie
 * über `hell` und `dunkel` sortiert, statt eine Reihenfolge anzunehmen.
 */
async function kontraste(page, auswahl) {
  const felder = await page.evaluate((auswahl) => {
    const raus = [];
    for (const el of document.querySelectorAll(auswahl)) {
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
  }, auswahl);
  await page.evaluate((auswahl) => document.querySelectorAll(auswahl)
    .forEach((el) => { el.style.visibility = "hidden"; }), auswahl);
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
  await page.evaluate((auswahl) => document.querySelectorAll(auswahl)
    .forEach((el) => { el.style.visibility = ""; }), auswahl);
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
  const netzFehler = [];
  page.on("requestfailed", (r) => netzFehler.push(`${r.url().slice(-40)} ${r.failure()?.errorText}`));
  page.on("response", (r) => { if (r.status() >= 400) netzFehler.push(`${r.url().slice(-40)} ${r.status()}`); });

  await page.goto(BASIS, { waitUntil: "domcontentloaded" });
  /*
   * Gewartet wird, bis die Ladeszene AUS DEM DOM ist, nicht bis sie „fertig"
   * meldet. Seit Phase 2 liegen zwischen beidem die fünf Schläge des
   * Übergangs — 4,2 s, in denen die Seite noch gesperrt ist. Wer auf das
   * Fertigsignal misst, misst mitten in den Staub hinein.
   */
  await page.waitForFunction(
    () => document.querySelector(".ladeschirm") === null,
    null, { timeout: 90_000 },
  ).catch(() => zeile("   (die Ladeszene übergab nicht)"));
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
    dunkel: document.querySelectorAll(".dunkel").length,
    textknoten: document.querySelectorAll(".wortmarke, .hinweis, .siegel").length,
  }));
  zeile(`   Bühnen ${aufbau.buehnen} · Canvas ${aufbau.canvas} · Textelemente ${aufbau.textknoten}`);
  zeile(`   Karten ${aufbau.karten} · Fortschrittsring ${aufbau.ring} · Abspann ${aufbau.abspann} · Kapiteltitel ${aufbau.kapitel}`);
  aufbau.buehnen === 1 ? passt("genau eine Bühne") : fehlt(`${aufbau.buehnen} Bühnen`);
  const zuviel = aufbau.karten + aufbau.ring + aufbau.abspann + aufbau.kapitel;
  zuviel === 0 ? passt("keine Karte, kein Ring, kein Abspann, kein Kapiteltitel")
    : fehlt(`${zuviel} Element(e), die nicht gebaut werden sollten`);
  aufbau.dunkel === 0 ? passt("keine flächige Abdunklung im DOM")
    : fehlt(`${aufbau.dunkel}× .dunkel — der Filter sollte in Phase 2 fort sein`);

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
      siegel: +getComputedStyle(document.querySelector(".siegel-unten")).opacity,
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
    // Das tatsächlich gezeichnete Bild fragen, nicht eine Zahl aus dem Bauskript.
    const probe = document.createElement("img");
    return new Promise((ok) => {
      probe.onload = () => {
        const iw = probe.naturalWidth, ih = probe.naturalHeight;
        const s = Math.max(c.width / iw, c.height / ih);
        ok({
          quelle: `${iw}×${ih}`,
          canvas: `${c.width}×${c.height}`,
          css: `${c.clientWidth}×${c.clientHeight}`,
          dichte: (c.width / c.clientWidth).toFixed(2),
          faktorCanvas: s,
          faktorGeraet: Math.max(
            (c.clientWidth * (window.devicePixelRatio || 1)) / iw,
            (c.clientHeight * (window.devicePixelRatio || 1)) / ih,
          ),
          wegBreite: 1 - c.width / (iw * s),
          wegHoehe: 1 - c.height / (ih * s),
        });
      };
      probe.src = document.querySelector("canvas").dataset.probe;
    });
  });
  zeile(`   Quelle ${schnitt.quelle} · Canvas ${schnitt.canvas} (CSS ${schnitt.css}, Dichte ${schnitt.dichte})`);
  zeile(`   Vergrößerung Quelle→Canvas ${schnitt.faktorCanvas.toFixed(2)}×`
    + ` · Quelle→Gerätepixel ${schnitt.faktorGeraet.toFixed(2)}×`);
  zeile(`   Beschnitt: ${(schnitt.wegBreite * 100).toFixed(0)} % der Breite,`
    + ` ${(schnitt.wegHoehe * 100).toFixed(0)} % der Höhe`);
  schnitt.faktorCanvas <= 1.001 ? passt("kein Hochskalieren auf den Canvas (Faktor ≤ 1,0)")
    : fehlt(`Canvas wird ${schnitt.faktorCanvas.toFixed(2)}× hochskaliert`);
  Math.max(schnitt.wegBreite, schnitt.wegHoehe) < 0.15
    ? passt(`Beschnitt unter 15 %`)
    : fehlt(`Beschnitt ${(Math.max(schnitt.wegBreite, schnitt.wegHoehe) * 100).toFixed(0)} % — braucht formatgerechtes Material`);

  // px je Bildwechsel — die Zahl hinter der Glätte.
  const glatt = await page.evaluate(() => {
    const b = document.querySelector(".buehne");
    const weg = b.offsetHeight - window.innerHeight;
    return { weg, hoehe: b.offsetHeight, fenster: window.innerHeight };
  });
  const FRAMES = 150, VON = 0.02, BIS = 0.80;
  const proWechsel = glatt.weg * (BIS - VON) / (FRAMES - 1);
  zeile(`   Bühne ${glatt.hoehe} px, Fenster ${glatt.fenster} px → Scrollweg ${glatt.weg} px`
    + ` · ${proWechsel.toFixed(1)} px je Bildwechsel`);
  proWechsel <= 30 ? passt("≤ 30 px je Bildwechsel") : fehlt(`${proWechsel.toFixed(1)} px je Bildwechsel`);

  /* Der Kontrast im Schlussbild — dunkler Text auf hellem Sand, ohne den
     Filter, der ihn bis Phase 2 getragen hat. */
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(hoehe));
  await page.waitForTimeout(1500);
  await kontraste(page, ".siegel p, .lockup-wort");


  /*
   * STEHT DIE SCHLANGE IM WORT ODER DANEBEN?
   *
   * Die Frage lässt sich rechnen, und sie muss gerechnet werden: „sieht
   * richtig aus" ist auf einer Aufnahme bei 39 % Fensterbreite Sandfläche
   * keine belastbare Aussage. Gerechnet wird aus drei Quellen, die alle DIE
   * SEITE selbst liefert — die Ringmaße stehen als `data-ring` am Canvas, die
   * Quellgröße kommt aus dem geladenen Frame, die Verwandlung aus dem
   * berechneten Stil. Kein Sollwert wird aus dem Quelltext abgeschrieben.
   */
  const sitz = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const platz = document.querySelector(".lockup-ring");
    const kastenEl = document.querySelector(".bild");
    if (!c || !platz || !kastenEl || !c.dataset.ring) return null;
    const [cx, cy, dAnteil] = c.dataset.ring.split(",").map(Number);
    return new Promise((ok) => {
      const probe = new Image();
      probe.onload = () => {
        const W = c.clientWidth, H = c.clientHeight;
        const deckung = Math.max(W / probe.naturalWidth, H / probe.naturalHeight);
        const bb = probe.naturalWidth * deckung, bh = probe.naturalHeight * deckung;
        const natX = (W - bb) / 2 + cx * bb;
        const natY = (H - bh) / 2 + cy * bh;
        const natD = dAnteil * bb;
        const m = new DOMMatrix(getComputedStyle(c).transform);
        // Der Kasten ohne Verwandlung: der Canvas liegt deckungsgleich auf .bild.
        const k = kastenEl.getBoundingClientRect();
        const ringX = k.left + W / 2 + (natX - W / 2) * m.a + m.e;
        const ringY = k.top + H / 2 + (natY - H / 2) * m.d + m.f;
        const r = platz.getBoundingClientRect();
        return ok({
          maßstab: m.a,
          ring: { x: ringX, y: ringY, d: natD * m.a },
          platz: { x: r.left + r.width / 2, y: r.top + r.height / 2, d: r.width },
          fenster: W,
        });
      };
      probe.src = c.dataset.probe;
    });
  });
  if (!sitz) {
    fehlt("Ring und Buchstabenplatz nicht messbar");
  } else {
    const dx = Math.abs(sitz.ring.x - sitz.platz.x);
    const dy = Math.abs(sitz.ring.y - sitz.platz.y);
    const dd = Math.abs(sitz.ring.d - sitz.platz.d);
    zeile(`   Ring ${sitz.ring.d.toFixed(0)} px bei ${sitz.ring.x.toFixed(0)}/${sitz.ring.y.toFixed(0)}`
      + ` · Buchstabenplatz ${sitz.platz.d.toFixed(0)} px bei ${sitz.platz.x.toFixed(0)}/${sitz.platz.y.toFixed(0)}`
      + ` · Verwandlung ${sitz.maßstab.toFixed(3)}×`);
    (dx <= 3 && dy <= 3)
      ? passt(`Ring sitzt IM Buchstaben (${dx.toFixed(1)} / ${dy.toFixed(1)} px daneben)`)
      : fehlt(`Ring steht ${dx.toFixed(0)} / ${dy.toFixed(0)} px neben dem Buchstaben`);
    dd <= 2 ? passt(`Ringgröße trifft den Platz (${dd.toFixed(1)} px Abweichung)`)
      : fehlt(`Ring ${sitz.ring.d.toFixed(0)} px gegen Platz ${sitz.platz.d.toFixed(0)} px`);
    sitz.maßstab <= 1.001
      ? passt(`kein Hochrechnen im Schlussbild (Verwandlung ${sitz.maßstab.toFixed(3)}×)`)
      : fehlt(`Verwandlung rechnet ${sitz.maßstab.toFixed(2)}× hoch`);
    const anteil = sitz.ring.d / sitz.fenster;
    zeile(`   Ring = ${(anteil * 100).toFixed(1)} % der Fensterbreite (Auftrag: 22,9 bis 23,1 %)`);
  }

  /*
   * WIRD DAS SCHLUSSBILD DUNKLER?
   *
   * Die Abdunklung ist aus dem Quelltext entfernt — das prüft schon der
   * Aufbau oben. Diese Messung prüft die WIRKUNG: die mittlere Helligkeit des
   * ganzen Fensters, einmal am Ende des Films und einmal im Schlussbild. Sie
   * fiele auch dann auf, wenn die Abdunklung unter einem anderen Namen
   * zurückkäme oder ein Schleier stehen bliebe.
   */
  const helligkeit = async () => {
    const b = await page.screenshot();
    return page.evaluate(async (b64) => {
      const bild = new Image();
      await new Promise((ok) => { bild.onload = ok; bild.src = "data:image/png;base64," + b64; });
      const c = document.createElement("canvas");
      c.width = 160; c.height = Math.round(160 * bild.height / bild.width);
      const ctx = c.getContext("2d");
      ctx.drawImage(bild, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const kanal = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      let summe = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        summe += 0.2126 * kanal(d[i]) + 0.7152 * kanal(d[i + 1]) + 0.0722 * kanal(d[i + 2]);
        n++;
      }
      return summe / n;
    }, b.toString("base64"));
  };
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(hoehe * 0.79));
  await page.waitForTimeout(1600);
  const vorher = await helligkeit();
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(hoehe));
  await page.waitForTimeout(1600);
  const nachher = await helligkeit();
  zeile(`   Mittlere Helligkeit: Filmende ${vorher.toFixed(3)} → Schlussbild ${nachher.toFixed(3)}`
    + ` (${((nachher / vorher - 1) * 100).toFixed(1)} %)`);
  nachher >= vorher * 0.97
    ? passt("das Schlussbild wird nicht dunkler")
    : fehlt(`das Schlussbild verliert ${((1 - nachher / vorher) * 100).toFixed(0)} % Helligkeit`);

  fehler.length === 0 ? passt("0 JS-Fehler") : fehlt(`${fehler.length} JS-Fehler: ${fehler.slice(0, 3).join(" | ")}`);
  netzFehler.length === 0 ? passt("0 fehlgeschlagene Netzanfragen")
    : fehlt(`${netzFehler.length} Netzfehler: ${netzFehler.slice(0, 3).join(" | ")}`);
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
      siegel: +getComputedStyle(document.querySelector(".siegel-unten")).opacity,
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
  /*
   * Kontrast auch HIER, und das ist der Punkt.
   *
   * Der Ruhemodus zeigt ein Standbild ohne Schleier und ohne Abdunklung: alles
   * darauf steht auf hellem Sand. Bis Phase 2 trug diese Stelle die Abdunklung
   * mit `opacity: 1 !important` — sie fiel weg, und damit fiel eine
   * Voraussetzung weg, die niemand mehr geprüft hätte. Die Pixelmessung des
   * Prüfstands kann es nicht: sie meldet innerhalb gepinnter Bühnen
   * `nicht_prüfbar`, weil ihre Aufnahme die Seite selbst verschiebt.
   */
  await kontraste(page, ".siegel p, .lockup-wort, .wortmarke");
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
    dauer < 4 ? passt("Freigabe unter 4 s bei 1,6 Mbit/s") : fehlt(`Freigabe erst nach ${dauer.toFixed(1)} s bei 1,6 Mbit/s`);
    // Und jetzt die volle Stufe: sie strömt nach, während schon gescrollt
    // werden kann. Gewartet wird, bis jeder Frame durch seine scharfe
    // Fassung ersetzt ist.
    const t1 = Date.now();
    await page.waitForFunction(
      () => performance.getEntriesByType("resource")
        .filter((r) => /\/seq\/[^/]+\/f\d+\.webp$/.test(r.name) && !/-vor\//.test(r.name)).length >= 100,
      null, { timeout: 120_000 },
    ).catch(() => zeile("   (volle Stufe kam nicht vollständig an)"));
    const gesamt = (Date.now() - start) / 1000;
    zeile(`   ${"".padEnd(21)} volle Stufe komplett nach ${gesamt.toFixed(1)} s`
      + ` (${((Date.now() - t1) / 1000).toFixed(1)} s davon im Hintergrund, nach der Freigabe)`);
    gesamt < 12 ? passt("volle Stufe unter 12 s bei 1,6 Mbit/s")
      : fehlt(`volle Stufe erst nach ${gesamt.toFixed(1)} s bei 1,6 Mbit/s`);
  }
  await page.close();
}

await browser.close();
zeile(gefallen === 0 ? "\nAlles bestanden." : `\n${gefallen} Punkt(e) gefallen.`);
process.exit(gefallen > 0 ? 1 : 0);
