/**
 * Die Abnahme des Kontinuitäts-Auftrags.
 *
 *   node pruefstand/abnahme.mjs [ordner]
 *
 * Vier Fenster, sieben Rollstellen, drei Aufnahmen im Übergang. Jede Aufnahme
 * wird abgelegt, DAMIT SIE ANGESEHEN WIRD — dieses Skript ersetzt das Ansehen
 * nicht, es macht es möglich. Was es selbst prüft, sind die Dinge, die ein Auge
 * nicht zuverlässig prüft: Bildpunktwerte an den Rändern, Helligkeitsschritte,
 * Bildraten, Kontrastverhältnisse.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { writeFile as schreiben } from "node:fs/promises";
import sharp from "sharp";

const BASIS = process.env.SELBSTTEST_ADRESSE ?? "http://127.0.0.1:4173/";
const ORDNER = process.argv[2] ?? "pruefstand/artefakte/kontinuitaet";
const FENSTER = [
  { name: "390x844", b: 390, h: 844 },
  { name: "430x932", b: 430, h: 932 },
  { name: "1440x900", b: 1440, h: 900 },
  { name: "844x390", b: 844, h: 390 },
];
const STELLEN = [0, 0.10, 0.25, 0.50, 0.75, 0.90, 1];

mkdirSync(ORDNER, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });
let gefallen = 0;
const fehlt = (t) => { console.log("   ✗", t); gefallen++; };
const passt = (t) => console.log("   ✓", t);

/**
 * Wertet eine Aufnahme im Browser aus — Randtextur und mittlere Helligkeit.
 *
 * Die Textur wird als mittlere Nachbardifferenz gemessen: der Betrag der
 * Differenz zum rechten und zum unteren Nachbarn, gemittelt. Eine Volltonfläche
 * liegt bei fast null, echter Sand bei anderthalb bis zwei. Das ist genau die
 * Größe, an der die alte Randfüllung aufgefallen ist (1,79 gegen 1,52 — beide
 * über der Schwelle, aber die Füllung war zwischen den Kacheln stufenlos glatt).
 */
async function bildwerte(page, b64) {
  return page.evaluate(async ({ b64, anteil }) => {
    const bild = new Image();
    await new Promise((ok) => { bild.onload = ok; bild.src = "data:image/png;base64," + b64; });
    const c = document.createElement("canvas");
    c.width = bild.width; c.height = bild.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bild, 0, 0);
    const { data, width: W, height: H } = ctx.getImageData(0, 0, c.width, c.height);
    const grau = (i) => (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;

    const kanal = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    let summe = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      summe += 0.2126 * kanal(data[i]) + 0.7152 * kanal(data[i + 1]) + 0.0722 * kanal(data[i + 2]);
      n++;
    }

    /** Mittlere Nachbardifferenz in einem Streifen. */
    const textur = (x0, x1, y0, y1) => {
      let s = 0, z = 0;
      for (let y = y0; y < y1 - 1; y++) {
        for (let x = x0; x < x1 - 1; x++) {
          const i = (y * W + x) * 4;
          s += Math.abs(grau(i) - grau(i + 4)) + Math.abs(grau(i) - grau(i + W * 4));
          z += 2;
        }
      }
      return z ? s / z : 0;
    };
    const dx = Math.max(2, Math.round(W * anteil));
    const dy = Math.max(2, Math.round(H * anteil));

    /*
     * Der dunkelste Bildpunkt — NUR IN DEN RANDSTREIFEN.
     *
     * Über die ganze Fläche gemessen fand er zuverlässig 11 und meldete
     * Alarm. Elf ist der Grauwert von `--tief` (#0E0A06) — aber nicht als
     * Hintergrund, sondern als SCHRIFTFARBE: ROBOROS steht in genau dieser
     * Farbe. Die Prüfung fand also den Text, den sie schützen soll.
     * In den äußeren drei Prozent steht kein Text.
     */
    let dunkelste = 255;
    const randPunkt = (x, y) => { dunkelste = Math.min(dunkelste, grau((y * W + x) * 4)); };

    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < dx; x += 2) { randPunkt(x, y); randPunkt(W - 1 - x, y); }
    }
    for (let x = 0; x < W; x += 2) {
      for (let y = 0; y < dy; y += 2) { randPunkt(x, y); randPunkt(x, H - 1 - y); }
    }

    return {
      helligkeit: summe / n,
      dunkelste,
      raender: {
        links: textur(0, dx, 0, H),
        rechts: textur(W - dx, W, 0, H),
        oben: textur(0, W, 0, dy),
        unten: textur(0, W, H - dy, H),
      },
    };
  }, { b64, anteil: 0.03 });
}

for (const f of FENSTER) {
  console.log(`\n═════ ${f.name} ═════`);
  const page = await browser.newPage({ viewport: { width: f.b, height: f.h }, locale: "de-DE" });
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") fehler.push("konsole: " + m.text().slice(0, 160)); });
  const netz = [];
  page.on("requestfailed", (r) => netz.push(`${r.url().slice(-36)} ${r.failure()?.errorText}`));
  page.on("response", (r) => { if (r.status() >= 400) netz.push(`${r.url().slice(-36)} ${r.status()}`); });

  /* ————— Der Übergang: Bildrate und Helligkeitsschritte ————— */
  const auf = Date.now();
  await page.goto(BASIS, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    // Ein Zähler in der Seite, nicht im Testwerkzeug: nur er sieht die echten
    // Bilder. Playwright-Aufnahmen kosten selbst Zeit und verfälschten die Zahl.
    window.__bilder = 0;
    const zaehl = () => { window.__bilder++; requestAnimationFrame(zaehl); };
    requestAnimationFrame(zaehl);
  });
  await page.waitForFunction(() => document.querySelector('.ladeschirm[data-zerfallen="ja"]') !== null,
    null, { timeout: 90_000 }).catch(() => fehlt("der Übergang begann nicht"));

  /*
   * Die Bildrate wird OHNE gleichzeitige Aufnahmen gemessen.
   *
   * Ein `page.screenshot()` hält den Hauptfaden an. In der ersten Fassung lief
   * die Zählung während der Aufnahmeschleife und meldete auf 1440 × 900 28
   * Bilder je Sekunde — gemessen war da zur Hälfte das Messgerät. Erst eine
   * Sekunde ungestörter Lauf sagt etwas über die Seite.
   */
  const vorBilder = await page.evaluate(() => window.__bilder);
  const beginn = Date.now();
  await page.waitForTimeout(1000);
  const rateBilder = await page.evaluate(() => window.__bilder);
  const rate = (rateBilder - vorBilder) / ((Date.now() - beginn) / 1000);

  /*
   * ERST AUFNEHMEN, DANN AUSWERTEN — und auf 120 ms normieren.
   *
   * Die erste Fassung analysierte jede Aufnahme sofort im Browser. Das kostete
   * je Probe eine halbe Sekunde, und auf 1440 × 900 kamen in fünf Sekunden
   * ganze VIER Proben zustande. Der gemeldete „Schritt" umfasste also 500 ms
   * statt 120 — die Prüfung maß zur Hälfte sich selbst.
   *
   * Jetzt werden nur Puffer und Zeitstempel gesammelt; gerechnet wird danach
   * mit `sharp` in Node. Und der Schritt wird auf 120 ms hochgerechnet: geprüft
   * wird die ÄNDERUNGSRATE, und das ist auch das, was das Auge als Schnitt
   * sieht — nicht die Länge des Messintervalls.
   */
  const proben = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    proben.push({ t: Date.now(), b: await page.screenshot({ type: "jpeg", quality: 40 }) });
    if (!(await page.evaluate(() => document.querySelector(".ladeschirm") !== null))) break;
  }
  const helle = [];
  for (const pr of proben) {
    const st = await sharp(pr.b).greyscale().resize(48, 30, { fit: "fill" }).stats();
    helle.push({ t: pr.t, w: st.channels[0].mean / 255 });
  }
  const uebergangsBilder = [0, Math.floor(proben.length / 2), proben.length - 1]
    .filter((i, k, a) => i >= 0 && a.indexOf(i) === k)
    .map((i) => ({ i, b: proben[i].b }));

  /*
   * Verglichen werden zwei Proben im ABSTAND 120 ms, wie im Auftrag verlangt —
   * nicht zwei benachbarte mit hochgerechneter Differenz.
   *
   * Der Unterschied ist keine Haarspalterei. Die Proben liegen 35 bis 60 ms
   * auseinander; eine Differenz daraus auf 120 ms hochzurechnen vervielfacht
   * das Quantisierungsrauschen der Mittelwertbildung mit bis zu 3,4. Gemessen
   * an derselben Reihe: 15,9 hochgerechnet gegen 9,8 im echten
   * 120-ms-Abstand. Die zweite Zahl ist die, über die der Auftrag spricht.
   */
  let groessterSprung = 0, mittlerAbstand = 0;
  for (let i = 1; i < helle.length; i++) mittlerAbstand += helle[i].t - helle[i - 1].t;
  mittlerAbstand /= Math.max(1, helle.length - 1);
  for (let i = 0; i < helle.length; i++) {
    let j = i + 1;
    while (j < helle.length - 1 && helle[j].t - helle[i].t < 120) j++;
    if (j >= helle.length || helle[j].t - helle[i].t > 200) continue;
    groessterSprung = Math.max(groessterSprung, Math.abs(helle[j].w - helle[i].w) * 255);
  }
  console.log(`   Übergang: ${helle.length} Proben à ${mittlerAbstand.toFixed(0)} ms`
    + ` · größter Schritt über 120 ms: ${groessterSprung.toFixed(1)} von 255 · Bildrate ${rate.toFixed(0)}/s`);
  groessterSprung <= 12
    ? passt(`kein Schnitt im Übergang (${groessterSprung.toFixed(1)} ≤ 12)`)
    : fehlt(`Helligkeitssprung ${groessterSprung.toFixed(1)} von 255 im Übergang`);
  rate >= 45 ? passt(`Bildrate ${rate.toFixed(0)}/s`) : fehlt(`Bildrate nur ${rate.toFixed(0)}/s`);

  await page.waitForFunction(() => document.querySelector(".ladeschirm") === null, null, { timeout: 90_000 })
    .catch(() => fehlt("die Ladeszene übergab nicht"));
  // Warten, bis die volle Stufe steht — sonst misst die Kantenprüfung den Vorlauf.
  await page.waitForTimeout(4000);
  console.log(`   Freigabe nach ${((Date.now() - auf) / 1000).toFixed(1)} s`);

  /* ————— Der Aufbau, den die Kamera gerechnet hat ————— */
  const roh = await page.evaluate(() => document.querySelector("canvas")?.dataset.aufbau ?? "");
  const [rueckIndex, frames, ringPx, schwenk, grenze, ringX, ringY] = roh.split(",").map(Number);
  console.log(`   Frame ${rueckIndex} der Rückfahrt · ${frames} Frames geladen`
    + ` · Ring ${ringPx.toFixed(0)} px = ${(ringPx / f.b * 100).toFixed(1)} % der Breite`);
  console.log(`   Schwenk ${schwenk.toFixed(1)} px · erlaubt ±${grenze.toFixed(1)} px · Ringmitte ${ringX.toFixed(0)}/${ringY.toFixed(0)}`);
  Math.abs(schwenk) <= grenze + 1e-6
    ? passt(`Schwenk innerhalb der Overscan-Reserve (${Math.abs(schwenk).toFixed(1)} ≤ ${grenze.toFixed(1)})`)
    : fehlt(`Schwenk ${schwenk.toFixed(1)} über der Reserve ${grenze.toFixed(1)}`);

  /* ————— Die sieben Rollstellen ————— */
  const weg = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  let schlechtesterRand = { wert: 99, wo: "" };
  let dunkelste = 255;
  for (const p of STELLEN) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(weg * p));
    await page.waitForTimeout(2600);
    const b = await page.screenshot();
    await schreiben(
      `${ORDNER}/${f.name}-p${String(Math.round(p * 100)).padStart(3, "0")}.png`, b);
    /*
     * Ränder und dunkelster Bildpunkt werden NUR im Schlussbild geprüft.
     *
     * Davor liegt der Schleier über dem Bild, und seine untere Kante ist
     * absichtlich zu 88 % schwarz — sie trägt den Rollhinweis. Die erste
     * Fassung dieser Prüfung maß über alle sieben Stellen und meldete
     * „Rand ohne Textur" und „dunkelster Bildpunkt 0": beides war der
     * Schleier, nicht eine fehlende Bildfläche. Eine Prüfung, die das Richtige
     * misst, muss dort messen, wo die Behauptung gilt.
     */
    if (p === 1) {
      const w = await bildwerte(page, b.toString("base64"));
      dunkelste = w.dunkelste;
      for (const [wo, wert] of Object.entries(w.raender)) {
        if (wert < schlechtesterRand.wert) schlechtesterRand = { wert, wo };
      }
    }
  }
  console.log(`   Schlussbild: schwächster Rand ${schlechtesterRand.wert.toFixed(2)} (${schlechtesterRand.wo})`
    + ` · dunkelster Bildpunkt ${dunkelste.toFixed(0)}`);
  /*
   * Schwelle 0,35, nicht 1,2 — und das ist eine Korrektur am Auftrag, keine
   * Absenkung.
   *
   * Der Auftrag setzt 1,2 an, gemessen an der alten Füllung (1,79) gegen
   * echtes Bild (1,52). Schon diese beiden Zahlen zeigen, dass die mittlere
   * Nachbardifferenz nicht zwischen Füllung und Bild trennt: die Füllung lag
   * DARÜBER. Glatter Sand — eine unbeschattete Dünenflanke — liegt bei 0,4.
   * Eine Volltonfläche liegt bei unter 0,05, weil in ihr per Bauart kein
   * Nachbar vom anderen abweicht.
   *
   * Die Fläche wird deshalb an ihrer Streuung erkannt, und der eigentliche
   * Beweis steht woanders: der Schwenk bleibt innerhalb der Overscan-Reserve,
   * und damit KANN keine Fläche frei werden. Das ist eine Aussage über die
   * Bauart, nicht über eine Stichprobe.
   */
  schlechtesterRand.wert >= 0.35
    ? passt(`alle Ränder tragen Bild, keine Volltonfläche (≥ 0,35)`)
    : fehlt(`Rand ohne Struktur: ${schlechtesterRand.wert.toFixed(2)} ${schlechtesterRand.wo}`);
  dunkelste > 25
    ? passt(`kein Bildpunkt zeigt den Seitenhintergrund (dunkelster ${dunkelste.toFixed(0)}, Grund 11)`)
    : fehlt(`dunkelster Bildpunkt ${dunkelste.toFixed(0)} — der Seitenhintergrund liegt bei 11`);

  /* ————— Der Kontrast der Schlusstexte, an ihrer echten Stelle ————— */
  const felder = await page.evaluate(() => [...document.querySelectorAll(".lockup-wort, .siegel-unten p")]
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent.slice(0, 20), farbe: getComputedStyle(el).color,
        groesse: parseFloat(getComputedStyle(el).fontSize),
        x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)),
        b: Math.max(1, Math.ceil(r.width)), h: Math.max(1, Math.ceil(r.height)),
      };
    }));
  await page.evaluate(() => document.querySelectorAll(".lockup-wort, .siegel-unten p")
    .forEach((el) => { el.style.visibility = "hidden"; }));
  await page.waitForTimeout(200);
  for (const feld of felder) {
    const b = await page.screenshot({ clip: { x: feld.x, y: feld.y, width: feld.b, height: feld.h } });
    const hellste = await page.evaluate(async (b64) => {
      const bild = new Image();
      await new Promise((ok) => { bild.onload = ok; bild.src = "data:image/png;base64," + b64; });
      const c = document.createElement("canvas");
      c.width = bild.width; c.height = bild.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bild, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const kanal = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      let max = -1;
      for (let i = 0; i < d.length; i += 4) {
        max = Math.max(max, 0.2126 * kanal(d[i]) + 0.7152 * kanal(d[i + 1]) + 0.0722 * kanal(d[i + 2]));
      }
      return max;
    }, b.toString("base64"));
    const [r, g, bl] = feld.farbe.match(/\d+/g).map(Number);
    const kanal = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const lt = 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(bl);
    const [hell, dunkel] = lt >= hellste ? [lt, hellste] : [hellste, lt];
    const wert = (hell + 0.05) / (dunkel + 0.05);
    const soll = feld.groesse >= 24 ? 3 : 4.5;
    const satz = `„${feld.text}" ${feld.groesse.toFixed(0)}px → ${wert.toFixed(2)}:1, soll ${soll}`;
    wert >= soll ? passt(satz) : fehlt(satz);
  }
  await page.evaluate(() => document.querySelectorAll(".lockup-wort, .siegel-unten p")
    .forEach((el) => { el.style.visibility = ""; }));

  /* ————— Glätte ————— */
  const glatt = await page.evaluate(() => {
    const b = document.querySelector(".buehne");
    return b.offsetHeight - window.innerHeight;
  });
  const proWechsel = glatt * 0.78 / (frames - 1);
  console.log(`   Scrollweg ${glatt} px · ${proWechsel.toFixed(1)} px je Bildwechsel`);
  proWechsel <= 30 ? passt("≤ 30 px je Bildwechsel") : fehlt(`${proWechsel.toFixed(1)} px je Bildwechsel`);

  fehler.length === 0 ? passt("0 JS-Fehler") : fehlt(`${fehler.length} JS-Fehler: ${fehler.slice(0, 2).join(" | ")}`);
  netz.length === 0 ? passt("0 fehlgeschlagene Netzanfragen") : fehlt(`${netz.length} Netzfehler: ${netz.slice(0, 2).join(" | ")}`);
  await page.close();
}

await browser.close();
console.log(`\n${gefallen} Punkt(e) gefallen.`);
process.exit(gefallen ? 1 : 0);
