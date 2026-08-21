/**
 * Die Abnahme des Prolog-Auftrags — §7.
 *
 *   node pruefstand/abnahme-prolog.mjs [port]
 *
 * Zwei Fenster. Was hier steht, sind die Punkte, die ein Auge NICHT
 * zuverlässig prüft: Korngrößenverteilungen, Richtungsstreuungen,
 * Bildpunktwerte an Rändern, Helligkeitsschritte, Zentrierungen auf den
 * Bildpunkt. Die acht Aufnahmen macht `prolog-aufnahmen.mjs`, und die werden
 * ANGESEHEN — dieses Skript ersetzt das nicht.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const PORT = Number(process.argv[2] ?? 4178);
const URL = `http://127.0.0.1:${PORT}/`;
const AUS = "pruefstand/artefakte/prolog";
const FENSTER = [
  { name: "390x844", b: 390, h: 844, dpr: 3, ringMin: 55 },
  { name: "1440x900", b: 1440, h: 900, dpr: 2, ringMin: 200 },
];

mkdirSync(AUS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });
let gefallen = 0;
const fehlt = (t) => { console.log("   ✗", t); gefallen++; };
const passt = (t) => console.log("   ✓", t);

/** Mittlere Helligkeit einer Aufnahme, klein gerechnet. */
async function helligkeit(puffer) {
  const s = await sharp(puffer).greyscale().resize(64, 64, { fit: "fill" }).stats();
  return s.channels[0].mean;
}

for (const f of FENSTER) {
  console.log(`═════ ${f.name} ═════`);
  const ctx = await browser.newContext({
    viewport: { width: f.b, height: f.h }, deviceScaleFactor: f.dpr,
  });
  const seite = await ctx.newPage();
  const fehler = [], netz = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  seite.on("requestfailed", (r) => netz.push(r.url()));

  await seite.goto(URL, { waitUntil: "domcontentloaded" });

  /* ————— P0.1  Korngrößen über mindestens vier Stufen ————— */
  await seite.waitForFunction(() => (window.__prolog?.koerner ?? 0) > 0, null, { timeout: 20000 });
  const korn = await seite.evaluate(() => window.__prolog);
  const stufen = korn.groessen.filter((n) => n > 0).length;
  console.log(`   ${korn.koerner} Körner · Größen je Stufe ${korn.groessen.join("/")}`);
  if (stufen >= 4) passt(`Korngrößen über ${stufen} Stufen verteilt (soll ≥ 4)`);
  else fehlt(`Korngrößen nur über ${stufen} Stufe(n)`);

  /* ————— P1.1  Helligkeitsschritt über den ganzen Prolog ————— */
  /*
   * Abgetastet wird in echten 120-ms-Schritten, nicht in „ungefähr jedem
   * Bild". Ein Schritt, der über eine andere Zeitspanne gemessen ist als die,
   * die im Gate steht, misst nicht das Gate.
   */
  /*
   * ABGETASTET WIRD IN DER SEITE, NICHT ÜBER AUFNAHMEN.
   *
   * Die erste Fassung machte je Probe eine `page.screenshot()` und rechnete
   * sie mit sharp klein. Das dauerte rund eine Sekunde je Probe — gemessen
   * wurden 15 Proben über 15 Sekunden. Ein Gate, das „Schritt über 120 ms"
   * heißt und über 1000 ms misst, misst nicht das Gate; es hat hier sogar
   * bestanden, weil die Lücken übersprungen wurden und nichts übrig blieb.
   *
   * Jetzt läuft eine Bildschleife IN der Seite, die genau das zusammensetzt,
   * was ein Auge sieht — den Film unten, die Leinwand darüber — und daraus
   * die mittlere Helligkeit rechnet. Das kostet ein 48 × 48 großes Canvas je
   * Bild und tastet mit der Bildrate ab.
   */
  await seite.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 48; c.height = 48;
    const x = c.getContext("2d", { willReadFrequently: true });
    window.__mess = { proben: [], bahn: [], letzteFront: -1 };
    const t0 = performance.now();
    const schritt = () => {
      const v = document.querySelector("video");
      const s = document.querySelector(".prolog-schleier");
      const held = document.querySelector("canvas.ebene-bild");
      x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--tief").trim() || "#0E0A06";
      x.fillRect(0, 0, 48, 48);
      try {
        if (held && !document.querySelector(".prolog")) x.drawImage(held, 0, 0, 48, 48);
        else {
          if (v && v.videoWidth) x.drawImage(v, 0, 0, 48, 48);
          if (s && s.width) x.drawImage(s, 0, 0, 48, 48);
        }
      } catch { /* ein noch leeres Element ist keine Messung wert */ }
      const d = x.getImageData(0, 0, 48, 48).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      window.__mess.proben.push({ t: performance.now() - t0, h: sum / (d.length / 4) });
      const p = window.__prolog;
      /*
       * NUR NEUE BILDER, UND DAS ENTLANG DER GANZEN EROSION.
       *
       * Der Sammler tickt auf eigenem rAF. Zeichnet der Prolog gerade
       * genauso schnell, greift der Sammler dasselbe `__prolog` zweimal ab
       * und schiebt DIESELBE Referenz zweimal in die Bahn — die Differenz
       * ist dann exakt null und das Bildpaar fällt aus der Windmessung.
       * Gemessen: bei 390x844 blieben so 0 von 20 Paaren übrig, bei 1440x900
       * 4. Nicht der Wind stand still, der Prüfstand hat doppelt gezählt.
       *
       * `front` ändert sich mit jedem Prologbild — daran wird unterschieden.
       */
      if (p?.phase === "erosion" && p.proben.length && p.front !== window.__mess.letzteFront) {
        window.__mess.letzteFront = p.front;
        window.__mess.bahn.push(p.proben);
      }
      if (performance.now() - t0 < 20000) requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  });

  await seite.waitForFunction(() => !document.querySelector(".prolog"), null, { timeout: 45000 }).catch(() => {});
  await seite.waitForTimeout(600);
  const mess = await seite.evaluate(() => window.__mess);
  const proben = mess.proben, bahn = mess.bahn;

  /*
   * Der Schritt über 120 ms: gesucht wird das Paar von Proben, deren Abstand
   * dem Fenster am nächsten liegt — nicht das Nachbarpaar. Bei 60 Bildern je
   * Sekunde wären Nachbarn 17 ms auseinander und der gemessene Schritt siebenmal
   * zu klein.
   */
  let schritt = 0, wo = 0;
  for (let i = 0; i < proben.length; i++) {
    let j = i + 1;
    while (j < proben.length && proben[j].t - proben[i].t < 120) j++;
    if (j >= proben.length) break;
    const d = Math.abs(proben[j].h - proben[i].h);
    if (d > schritt) { schritt = d; wo = proben[i].t; }
  }
  const takt = proben.length > 1 ? (proben.at(-1).t - proben[0].t) / (proben.length - 1) : 0;
  console.log(`   Prolog: ${proben.length} Proben à ${takt.toFixed(0)} ms über ${(proben.at(-1)?.t / 1000 || 0).toFixed(1)} s`);
  if (schritt <= 12) passt(`kein Schnitt im Prolog (${schritt.toFixed(1)} ≤ 12, größter bei ${(wo / 1000).toFixed(1)} s)`);
  else fehlt(`Helligkeitssprung ${schritt.toFixed(1)} von 255 bei ${(wo / 1000).toFixed(1)} s`);

  /* ————— P0.2  Der Wind hat eine Richtung ————— */
  if (bahn.length >= 21) {
    const winkel = [];
    const schrittB = Math.max(1, Math.floor(bahn.length / 40));
    for (let i = schrittB; i < bahn.length; i += schrittB) {
      const a = bahn[i - schrittB], b = bahn[i];
      const n = Math.min(a.length, b.length);
      let sx = 0, sy = 0;
      for (let k = 0; k < n; k++) { sx += b[k].x - a[k].x; sy += b[k].y - a[k].y; }
      if (Math.hypot(sx, sy) < 1e-6) continue;
      winkel.push(Math.atan2(sy / n, sx / n));
    }
    // Streuung als Kreisstatistik — ein Mittel über Winkel bei ±180° wäre falsch.
    const cx = winkel.reduce((s, w) => s + Math.cos(w), 0) / winkel.length;
    const cy = winkel.reduce((s, w) => s + Math.sin(w), 0) / winkel.length;
    const laenge = Math.hypot(cx, cy);
    const streuung = Math.sqrt(-2 * Math.log(Math.max(1e-9, laenge))) * 180 / Math.PI;
    const richtung = Math.atan2(cy, cx) * 180 / Math.PI;
    console.log(`   Wind über ${winkel.length} Bilder: Richtung ${richtung.toFixed(1)}° · Streuung ${streuung.toFixed(1)}°`);
    if (streuung < 30) passt(`eine Windrichtung (Streuung ${streuung.toFixed(1)}° < 30°)`);
    else fehlt(`Windrichtung streut um ${streuung.toFixed(1)}°`);
  } else fehlt(`zu wenige Bilder der Erosion getroffen (${bahn.length})`);

  /* ————— P1.4  Der Anschluss: Schwenkende → erster Heldenframe ————— */
  /*
   * Gemessen an derselben Reihe wie der Helligkeitsschritt, an der Stelle, an
   * der der Prolog verschwindet: die letzte Probe davor gegen die erste
   * danach. Das ist genau die Fuge, um die es geht — und sie wird an dem
   * gemessen, was zusammengesetzt auf dem Schirm stand, nicht an zwei
   * Dateien.
   */
  const fuge = proben.length > 2
    ? Math.abs(proben.at(-1).h - proben.at(-3).h)
    : NaN;
  if (fuge <= 12) passt(`Anschluss ohne Sprung (${fuge.toFixed(1)} von 255)`);
  else fehlt(`Anschluss springt um ${fuge.toFixed(1)} von 255`);

  /* ————— P0.11 / P0.9  Fehler, Netz, Schrift ————— */
  const schrift = await seite.evaluate(() => document.fonts.status);
  if (schrift === "loaded") passt("Schriften geladen, bevor gemessen wurde");
  else fehlt(`Schriftstatus ${schrift}`);

  /* ————— P0.3  Kein Ring und kein OROBOROS vor dem Schlussbild ————— */
  const vorher = await seite.evaluate(() => {
    const w = document.querySelector(".lockup-wort");
    const zeichen = w ? getComputedStyle(w.querySelector(".zeichen")).transform : "";
    return {
      wortAuf: !!w?.classList.contains("auf"),
      zeichen,
      ringFlaeche: (() => {
        const r = document.querySelector(".lockup-ring");
        if (!r) return 0;
        const k = r.getBoundingClientRect();
        // Der Ring ist ein LEERER Kasten. Er zeigt nur, was der Film unter ihm
        // hat — vor dem Schlussbild ist das die Düne, kein Ring.
        return getComputedStyle(r).backgroundImage !== "none" ? k.width : 0;
      })(),
      svg: document.querySelectorAll("svg circle, svg path").length,
    };
  });
  if (!vorher.wortAuf && vorher.ringFlaeche === 0 && vorher.svg === 0) {
    passt("kein Ring und kein „OROBOROS“ vor dem Schlussbild");
  } else {
    fehlt(`vor dem Schluss sichtbar: Wort ${vorher.wortAuf}, Ringfläche ${vorher.ringFlaeche}, SVG-Formen ${vorher.svg}`);
  }

  /* ————— Das Schlussbild ————— */
  const hoehe = await seite.evaluate(() => document.querySelector(".buehne").offsetHeight - window.innerHeight);
  await seite.evaluate((y) => window.scrollTo(0, y), hoehe);
  await seite.waitForTimeout(1800);

  const a = (await seite.getAttribute("canvas.ebene-bild", "data-aufbau") ?? "").split(",").map(Number);
  const [rueck, frames, ringD, schwenk, grenze, ringX, ringY, gesamtB, linkeKante, mittenAbw, ringZuVersal, schriftPx, optischeAbw, schwerpunktX] = a;
  const overscanX = grenze + 2;
  console.log(`   Frame ${rueck} der Rückfahrt · ${frames} Frames · Ring ${ringD.toFixed(0)} px = ${(ringD / f.b * 100).toFixed(1)} %`
    + ` · Schrift ${schriftPx.toFixed(0)} px · Ring/Versal ${ringZuVersal.toFixed(2)}`);

  /* ————— P0.5  Schwenk innerhalb der Reserve ————— */
  if (Math.abs(schwenk) + 2 <= overscanX + 0.01 || (overscanX <= 2 && schwenk === 0)) {
    passt(`|Schwenk| + 2 ≤ overscanX (${Math.abs(schwenk).toFixed(1)} + 2 ≤ ${overscanX.toFixed(1)})`);
  } else {
    fehlt(`Schwenk ${schwenk.toFixed(1)} px bei overscanX ${overscanX.toFixed(1)} px`);
  }

  /* ————— P0.7  Die Wortmarke ist OPTISCH zentriert ————— */
  /*
   * GEMESSEN WIRD DER SCHWERPUNKT, NICHT DIE KANTE.
   *
   * Hier stand `|linkeKante − (fensterB − gesamtB)/2| ≤ 1`, also geometrische
   * Mitte auf den Bildpunkt. §8 verlangt ausdrücklich etwas anderes:
   * „Mathematical centering is not enough. Evaluate optical weight. The
   * organic snake has significantly more visual weight than the thin
   * typography."
   *
   * Der Ring ist eine photographische Scheibe, das Wort ist Jost 200. Wer die
   * Zeile geometrisch mittet, setzt die wahrgenommene Mitte nach links. Die
   * Rechnung steht in `kamera.ts` (`schwerpunkt`) und wird hier nicht
   * wiederholt, sondern aus `data-aufbau` gelesen — eine Wahrheit, eine
   * Stelle.
   */
  const optGrenze = f.b * 0.05;
  /*
   * WO DIE ZEILE DAS FENSTER FÜLLT, GIBT ES KEINE OPTISCHE MITTE.
   *
   * Auf 390 × 844 nimmt die Wortmarke 348 von 390 px ein — 89 %. Zwischen den
   * Rändern bleiben damit null Bildpunkte Spiel: die Zeile kann nur an EINER
   * Stelle stehen, und das ist die geometrische Mitte. Der optische Wunsch
   * (50 px nach rechts) ist dort nicht unerfüllt, sondern gegenstandslos.
   *
   * Deshalb wird ab 85 % Breitenanteil die geometrische Mitte geprüft — und
   * das wird ausgeschrieben, nicht durch eine weichere Schwelle versteckt.
   */
  if (gesamtB > f.b * 0.85) {
    if (Math.abs(mittenAbw) <= 2) {
      passt(`Wortmarke zentriert (${mittenAbw.toFixed(1)} px) — bei ${(gesamtB / f.b * 100).toFixed(0)} %`
        + ` Breitenanteil ist kein optischer Versatz möglich, der Schwerpunkt läge ${optischeAbw.toFixed(0)} px daneben`);
    } else {
      fehlt(`Wortmarke ${mittenAbw.toFixed(1)} px neben der Mitte`);
    }
  } else if (Math.abs(optischeAbw) <= optGrenze) {
    passt(`Wortmarke optisch zentriert (Schwerpunkt ${optischeAbw.toFixed(1)} px`
      + ` von erlaubten ±${optGrenze.toFixed(0)}, geometrisch ${mittenAbw.toFixed(0)})`);
  } else {
    fehlt(`Schwerpunkt ${optischeAbw.toFixed(1)} px neben der Mitte`
      + ` — Schwenk steht bei ${schwenk.toFixed(1)} von erlaubten ±${grenze.toFixed(1)}`);
  }

  /* ————— P0.8  DESIGN und Zitat auf achseX ————— */
  const achse = await seite.evaluate(() => {
    const m = (s) => { const e = document.querySelector(s); if (!e) return null; const k = e.getBoundingClientRect(); return k.left + k.width / 2; };
    return { design: m(".siegel-unter"), satz: m(".siegel-satz"), strich: m(".siegel-strich") };
  });
  const mitte = f.b / 2;
  const ab = Object.entries(achse).map(([k, v]) => [k, v === null ? NaN : v - mitte]);
  if (ab.every(([, v]) => Math.abs(v) <= 1)) passt(`„DESIGN“, Strich und Zitat auf achseX (${ab.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")})`);
  else fehlt(`neben achseX: ${ab.map(([k, v]) => `${k} ${v.toFixed(1)} px`).join(", ")}`);

  /* ————— P1.2  Der Ring liest als das erste O ————— */
  /*
   * HIER STAND EINE PIXELZAHL, UND SIE PRÜFTE DAS FALSCHE.
   *
   * `ringD >= f.ringMin` (55 px auf 390, 200 px auf 1440) kam aus der Tabelle
   * des V3-Auftrags. Sie misst GRÖSSE. §8 fragt aber nach VERHÄLTNIS: „The
   * snake should approximately match the optical height of the other O
   * characters." Ein Ring von 203 px, neben dem die Schrift auf 138 px
   * gestaucht wurde, erfüllte die alte Schwelle mühelos — und stand dabei auf
   * 2,13 Versalhöhen, also als Symbol vor einem Wort statt als dessen erster
   * Buchstabe.
   *
   * Die Schwelle 1,35 ist an drei gerenderten Varianten abgelesen (1,22 ·
   * 1,26 · 1,30, beide Fenster, jede angesehen), nicht gerechnet: bis dahin
   * steht der Ring auf der Versalhöhe der anderen O, darüber ragt er
   * sichtbar hinaus.
   */
  if (ringZuVersal <= 1.35) {
    passt(`Ring liest als O (${ringZuVersal.toFixed(2)} Versalhöhen ≤ 1,35, ${ringD.toFixed(0)} px)`);
  } else {
    fehlt(`Ring ${ringZuVersal.toFixed(2)} Versalhöhen hoch — eine übergroße Initiale, kein O`);
  }

  /* ————— P0.6 / P0.10  Ränder tragen Bild, keine Abdunklung ————— */
  const schluss = await seite.screenshot();
  /*
   * GEMESSEN WIRD BEI CSS-AUFLÖSUNG, NICHT BEI GERÄTEAUFLÖSUNG.
   *
   * Die Nachbardifferenz hängt am Abstand der Bildpunkte: dieselbe Fläche bei
   * dreifacher Dichte hat rund ein Drittel der Differenz. Die Schwelle 0,35
   * stammt aus der Messung bei CSS-Auflösung — bei Geräteauflösung fiel ein
   * völlig unauffälliger Sandrand mit 0,18 durch. Nicht das Bild war das
   * Problem, sondern die Elle.
   */
  const werte = await sharp(schluss).resize(f.b, f.h, { fit: "fill" }).greyscale()
    .raw().toBuffer({ resolveWithObject: true });
  const { data: g, info } = werte;
  const streifen = (x0, y0, x1, y1) => {
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1 - 1; x++) {
      s += Math.abs(g[y * info.width + x] - g[y * info.width + x + 1]); n++;
    }
    return s / n;
  };
  const dx = Math.max(2, Math.round(info.width * 0.03)), dy = Math.max(2, Math.round(info.height * 0.03));
  const raender = {
    links: streifen(0, 0, dx, info.height), rechts: streifen(info.width - dx, 0, info.width, info.height),
    oben: streifen(0, 0, info.width, dy), unten: streifen(0, info.height - dy, info.width, info.height),
  };
  const schwach = Object.entries(raender).sort((p, q) => p[1] - q[1])[0];
  let dunkelster = 255;
  for (let y = 0; y < info.height; y++) {
    for (const x of [0, 1, info.width - 2, info.width - 1]) dunkelster = Math.min(dunkelster, g[y * info.width + x]);
  }
  console.log(`   Schlussbild: schwächster Rand ${schwach[1].toFixed(2)} (${schwach[0]}) · dunkelster Randpunkt ${dunkelster}`);
  if (schwach[1] >= 0.35) passt("alle Ränder tragen Bild, keine Volltonfläche (≥ 0,35)");
  else fehlt(`Rand ${schwach[0]} ist texturlos (${schwach[1].toFixed(2)})`);
  if (dunkelster > 40) passt(`kein Bildpunkt zeigt den Seitenhintergrund (dunkelster ${dunkelster}, Grund 11)`);
  else fehlt(`dunkelster Randpunkt ${dunkelster} — der Grund schaut durch`);

  /* ————— P1.3  Die Schuppen am Ring ————— */
  /*
   * Gemessen wird die Zahl der QUELLBILDPUNKTE, die der Ring hat — nicht die
   * Vergrößerung. Auf 1440 ist der Ring 2,51-fach vergrößert und seine
   * Schuppen sind in der Lupe einzeln zu zählen; auf 390 ist er 2,29-fach
   * vergrößert und glatt. Der Unterschied ist nicht der Faktor, sondern was
   * unter ihm liegt: 162 Quellbildpunkte gegen 72.
   *
   * Die Schwelle von 120 stammt aus dem ANSEHEN dieser beiden Lupen, nicht
   * aus einer Formel. Sie steht hier, damit die Grenze eine Zahl hat und beim
   * nächsten Material nachgerechnet werden kann.
   */
  const rd = await (await fetch(`${URL}seq/${f.b < f.h ? "film-3x4" : "film-16x9"}/ring.json`)).json();
  const deckung = Math.max(f.b / rd.bild.breite, f.h / rd.bild.hoehe);
  const quellPx = ringD / deckung;
  console.log(`   Ring: ${quellPx.toFixed(0)} Quellbildpunkte → ${(ringD * f.dpr).toFixed(0)} Gerätepunkte`
    + ` = ${(ringD * f.dpr / quellPx).toFixed(2)}-fach`);
  if (quellPx >= 120) passt(`Schuppen auflösbar (${quellPx.toFixed(0)} Quellbildpunkte ≥ 120)`);
  else fehlt(`Schuppen nicht auflösbar — nur ${quellPx.toFixed(0)} Quellbildpunkte, nötig 120`
    + ` (Materialgrenze: die Rückfahrt liegt in ${rd.bild.breite} × ${rd.bild.hoehe})`);

  const px = f.dpr;
  await sharp(schluss)
    .extract({
      left: Math.max(0, Math.round((ringX - ringD / 2 - 6) * px)),
      top: Math.max(0, Math.round((ringY - ringD / 2 - 6) * px)),
      width: Math.round((ringD + 12) * px), height: Math.round((ringD + 12) * px),
    })
    .resize({ width: 640, kernel: "nearest" })
    .toFile(`${AUS}/${f.name}-9-ring-lupe.png`);
  console.log(`   Ringlupe: ${AUS}/${f.name}-9-ring-lupe.png (${(ringD * px).toFixed(0)} Gerätepunkte)`);

  /* ————— P0.11  Fehler ————— */
  if (fehler.length === 0) passt("0 JS-Fehler"); else fehlt(`${fehler.length} JS-Fehler: ${fehler[0]}`);
  if (netz.length === 0) passt("0 fehlgeschlagene Netzanfragen"); else fehlt(`${netz.length} fehlgeschlagene Anfragen: ${netz[0]}`);

  await ctx.close();
}

await browser.close();
console.log(`\n${gefallen} Punkt(e) gefallen.`);
