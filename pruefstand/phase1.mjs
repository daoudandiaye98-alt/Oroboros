/**
 * Phase 1 — die Fuge, die Naht, die Stationen, das Scharnier.
 *
 *   node pruefstand/phase1.mjs [ordner]
 *
 * Fünf Fragen, und keine davon beantwortet sich durch Hinsehen allein:
 *
 *  1. DIE FUGE — springt der Ton, wo die Bühne endet und Phase 1 beginnt?
 *     Gemessen als Bilddifferenz zweier Bänder über und unter der Kante,
 *     nicht als „sieht gleich aus".
 *  2. DIE NAHT — sind Lockup und Kopfzeile je gleichzeitig zu sehen? Die
 *     Regel sagt: die Wortmarke bleibt, also darf es nie zwei geben.
 *  3. DIE STATIONEN — tritt jeder Container wirklich auf, oder steht einer
 *     mit Deckkraft 0 unter der Falz und niemand merkt es?
 *  4. DAS SCHARNIER — bewegt sich `stroke-dashoffset` über den Rollweg, oder
 *     hängt der Auslöser und die Linie steht? Ein Scrub, der nichts tut,
 *     sieht aus wie eine Linie, die einfach da ist.
 *  5. DER MARGINALIEN-VERSATZ — führt die Jahreszahl um `--versatz-zeichen`,
 *     oder ist die neue Rolle in `reveal.ts` eine Behauptung? Gemessen an den
 *     Endzeiten zweier Auftritte gleicher Dauer: deren Abstand IST der
 *     Versatz, weil die Kurve nur dazwischen wirkt und nicht am Ende.
 *
 * Die Aufnahmen sind kein Nebenprodukt. Sie sind der Beleg zu jeder Zahl
 * darüber, und sie werden angesehen, nicht abgelegt.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { writeFile as schreiben } from "node:fs/promises";
import sharp from "sharp";
import { buehnenweg, rolleAufBuehne, warteAufBuehne } from "./buehne.mjs";

const BASIS = process.env.SELBSTTEST_ADRESSE ?? "http://127.0.0.1:4173/";
const ORDNER = process.argv[2] ?? "pruefstand/artefakte/phase1";
const ANSICHTEN = [
  { name: "1440x900", breite: 1440, hoehe: 900 },
  { name: "390x844", breite: 390, hoehe: 844 },
];

/**
 * Die Grenze für die Fuge: 12 von 255.
 *
 * Der Auftrag nennt sie, und sie ist nicht willkürlich: unter etwa 2 % Abstand
 * zweier großflächiger Töne sieht das Auge auf einem gewöhnlichen Schirm keine
 * Kante mehr. Darüber sieht man sie sofort, weil eine gerade waagerechte Linie
 * das Auffälligste ist, was ein Bild haben kann.
 */
const FUGE_GRENZE = 12;
/** Wie hoch die beiden verglichenen Bänder sind, in Bildpunkten. */
const BAND = 8;
/** Ein Bild bei 60 Hz. Alles darunter ist Rauschen, nicht Befund. */
const BILD_MS = 1000 / 60;

let offen = 0;
const merker = [];
const zeile = (t) => { console.log(t); merker.push(t); };
const passt = (t) => zeile(`   BELEGT      ${t}`);
const fehlt = (t) => { offen += 1; zeile(`   NICHT BELEGT ${t}`); };

mkdirSync(ORDNER, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });

/** Mittlerer Betragsabstand zweier Bänder, je Kanal, in 0…255. */
async function bandabstand(png, breite, mitte) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const k = info.channels;
  const summe = [0, 0, 0];
  let n = 0;
  for (let dy = 1; dy <= BAND; dy++) {
    const oben = mitte - dy, unten = mitte + dy - 1;
    if (oben < 0 || unten >= info.height) continue;
    for (let x = 0; x < info.width; x++) {
      const a = (oben * info.width + x) * k, b = (unten * info.width + x) * k;
      for (let c = 0; c < 3; c++) summe[c] += Math.abs(data[a + c] - data[b + c]);
      n += 1;
    }
  }
  return n === 0 ? null : summe.map((s) => s / n);
}

for (const a of ANSICHTEN) {
  zeile(`\n═════ ${a.name} ═════`);
  const seite = await browser.newPage({ viewport: { width: a.breite, height: a.hoehe } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(e.message));

  await seite.goto(BASIS, { waitUntil: "networkidle" });
  await warteAufBuehne(seite);
  /*
   * Phase 1 wird im Leerlauf nachgeladen. Auf sie zu WARTEN statt eine Zeit
   * abzusitzen ist der Unterschied zwischen „ist da" und „war schnell genug":
   * eine feste Wartezeit hätte auf einem langsameren Läufer stumm gemessen,
   * was noch gar nicht im DOM stand.
   */
  await seite.waitForSelector(".epochen", { timeout: 30_000 });
  await seite.waitForSelector(".aktion", { timeout: 30_000 });
  const masse = await buehnenweg(seite);
  zeile(`   Bühne ${masse.weg + a.hoehe} px ab ${masse.oben} · Seite ${masse.seite + a.hoehe} px`);
  masse.oben === 0
    ? passt("Bühne beginnt bei 0 — die Kopfzeile nimmt keinen Platz im Fluss")
    : fehlt(`Bühne beginnt bei ${masse.oben} px — etwas schiebt sie nach unten`);

  /* ————————————————————————— 1 · DIE FUGE ————————————————————————— */
  zeile("\n── 1 · Die Fuge ──");
  const kante = masse.oben + masse.weg + a.hoehe;   // Unterkante der Bühne
  const mitte = Math.floor(a.hoehe / 2);
  await seite.evaluate((y) => window.scrollTo(0, y), kante - mitte);
  await seite.waitForTimeout(2600);
  const fugenbild = await seite.screenshot();
  await schreiben(`${ORDNER}/${a.name}-1-fuge.png`, fugenbild);
  const abstand = await bandabstand(fugenbild, a.breite, mitte);
  const groesster = Math.max(...abstand);
  zeile(`   Bänder à ${BAND} px über/unter der Kante bei y=${mitte}:`
    + ` R ${abstand[0].toFixed(2)} · G ${abstand[1].toFixed(2)} · B ${abstand[2].toFixed(2)} von 255`);
  groesster <= FUGE_GRENZE
    ? passt(`Fuge unsichtbar (${groesster.toFixed(2)} ≤ ${FUGE_GRENZE} von 255)`)
    : fehlt(`Fuge sichtbar: ${groesster.toFixed(2)} von 255, erlaubt ${FUGE_GRENZE}`);

  /* ————————————————————————— 2 · DIE NAHT ————————————————————————— */
  zeile("\n── 2 · Die Naht: die Wortmarke bleibt ──");
  /*
   * Gemessen wird SICHTBARKEIT, nicht Deckkraft.
   *
   * Das Lockup behält seine Deckkraft 1 und verlässt das Fenster, indem die
   * Bühne wegrollt. Wer nur `opacity` abfragt, sieht zwei Wortmarken und
   * meldet einen Fehler, den es nicht gibt. Wer nur die Kopfzeile abfragt,
   * sieht keinen und übersieht den, den es gäbe.
   */
  let doppelt = 0, keine = 0, schlimmste = 0;
  for (let i = 0; i <= 24; i++) {
    const y = kante - a.hoehe + Math.round((a.hoehe * 1.5) * (i / 24));
    await seite.evaluate((z) => window.scrollTo(0, z), y);
    await seite.waitForTimeout(180);
    const s = await seite.evaluate(() => {
      const sichtbar = (el) => {
        if (!el) return 0;
        const k = el.getBoundingClientRect();
        if (k.bottom <= 0 || k.top >= window.innerHeight || k.width === 0) return 0;
        // Deckkraft über alle Vorfahren: eine 0 irgendwo oben zählt.
        let o = 1;
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
          o *= parseFloat(getComputedStyle(n).opacity);
        }
        return o;
      };
      return {
        lockup: sichtbar(document.querySelector(".lockup")),
        kopf: sichtbar(document.querySelector(".kopfzeile-marke")),
      };
    });
    const beide = Math.min(s.lockup, s.kopf);
    if (beide > schlimmste) schlimmste = beide;
    if (beide > 0.02) doppelt += 1;
    if (s.lockup < 0.02 && s.kopf < 0.02) keine += 1;
  }
  zeile(`   25 Stellen über die Naht · stärkste Überlappung ${schlimmste.toFixed(3)}`
    + ` · doppelt an ${doppelt}, gar keine an ${keine} Stellen`);
  doppelt === 0
    ? passt("nie zwei Wortmarken gleichzeitig")
    : fehlt(`an ${doppelt} Stellen zwei Wortmarken (stärkste ${schlimmste.toFixed(3)})`);

  await seite.evaluate((y) => window.scrollTo(0, y), kante + Math.round(a.hoehe * 0.4));
  await seite.waitForTimeout(1200);
  await schreiben(`${ORDNER}/${a.name}-2-kopfzeile.png`, await seite.screenshot());

  /* ————————————— 5 · DER MARGINALIEN-VERSATZ ————————————— */
  /*
   * DREI ANLÄUFE, UND DIE ERSTEN ZWEI WAREN MESSFEHLER. Beide stehen hier,
   * weil ein Messgerät, dessen Irrtümer man wegwirft, beim nächsten Mal
   * denselben Irrtum wiederholt.
   *
   * ERSTER ANLAUF: 0 ms bei erklärten 55 ms. Nicht der Code war falsch — die
   * Naht-Messung darüber rollt bis unter die Bühnenkante, und dort beginnt
   * der Abschnitt. Der Auftritt war gelaufen, bevor der Sammler stand. Ein
   * Auftritt läuft einmal je Sitzung; ein zweites Mal gibt es nicht. Fortan:
   * frische Seite, und der Sammler prüft, ob er den Anfang gesehen hat.
   *
   * ZWEITER ANLAUF: 128 ms bei erklärten 55, auf beiden Ansichten
   * reproduzierbar. Die Marginalie läuft auf `--kurve-fein`, die Schlagzeile
   * auf `--kurve-standard`; wann eine Deckkraft die Schwelle 0,99 überquert,
   * hängt bei gleicher Dauer an der Kurve. Der Abstand zweier Überquerungen
   * ist Versatz PLUS Kurvenunterschied. Deshalb die GEGENPROBE: derselbe Lauf
   * mit `--versatz-zeichen: 0ms`. Der Kurvenanteil steht in beiden Läufen und
   * fällt in der Differenz heraus — und nebenbei belegt die Gegenprobe die
   * Behauptung des ganzen Gesetzes: die Zahl steht in `bewegung.css`, und
   * ändert man sie dort, ändert sich die Bewegung.
   *
   * DRITTER ANLAUF, dieser: die Gegenprobe stimmte, die Streuung nicht — 108
   * und 88 ms bei erklärten 55. Der Grund steht in den Proben selbst: der
   * Browser liefert hier keine 60 Bilder, sondern rund 50, und unregelmäßig.
   * GSAP schreibt die Deckkraft einmal je Bild; eine Überquerung ist also auf
   * das Bildraster gerundet, und der Abstand zweier Überquerungen trägt vier
   * solcher Rundungen. Bei 20 ms Bildabstand ist eine einzelne Messung von
   * 55 ms schlicht nicht auflösbar — sie unter die Zahl zu schreiben, wäre
   * genau die Behauptung unter dem Rauschen, die die Messregel verbietet.
   *
   * Also SECHS STATIONEN JE LAUF statt einer. Jede tritt an einer anderen
   * Rollposition auf, also in einer anderen Phase des Bildrasters — sechs
   * unabhängige Ziehungen desselben Werts. Berichtet wird der Mittelwert MIT
   * Fehlermaß, und geprüft wird erst, wenn das Fehlermaß kleiner ist als die
   * Grenze. Ein Mittelwert ohne Streuung wäre wieder nur eine Zahl.
   */
  zeile("\n── 5 · Der Marginalien-Versatz ──");

  /**
   * Alle Stationen einer FRISCHEN Sitzung auf einmal vermessen.
   *
   * Zurück kommt je Station der Abstand der beiden Auftritts-Enden — und die
   * Gründe für die, bei denen nichts zu messen war. Kein stilles Verwerfen.
   */
  async function versatzMessen(nullen) {
    const m = await browser.newPage({ viewport: { width: a.breite, height: a.hoehe } });
    await m.goto(BASIS, { waitUntil: "networkidle" });
    await warteAufBuehne(m);
    await m.waitForSelector(".epochen", { timeout: 30_000 });
    if (nullen) {
      await m.evaluate(() =>
        document.documentElement.style.setProperty("--versatz-zeichen", "0ms"));
    }
    const soll = await m.evaluate(() => parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--versatz-zeichen")));

    const paare = await m.evaluate(() => {
      window.__paare = [];
      for (const st of document.querySelectorAll("[data-station]")) {
        const marke = st.querySelector('[data-rolle="marginalie"]');
        const kopf = st.querySelector('[data-rolle="schlagzeile"]');
        if (marke && kopf) {
          window.__paare.push({ name: st.dataset.auftritt ?? st.className, marke, kopf });
        }
      }
      window.__proben = window.__paare.map(() => []);
      window.__bilder = [];
      const t0 = performance.now();
      (function tick() {
        const t = performance.now() - t0;
        if (t > 60_000) return;
        window.__bilder.push(t);
        window.__paare.forEach((pa, i) => {
          // Die Schlagzeile wird in Stücke zerlegt; das erste Stück trägt die
          // Bewegung, die Hülle wird sofort auf 1 gesetzt.
          const stueck = pa.kopf.querySelector(".teil") ?? pa.kopf;
          window.__proben[i].push([t, +getComputedStyle(pa.marke).opacity,
            +getComputedStyle(stueck).opacity]);
        });
        requestAnimationFrame(tick);
      })();
      return window.__paare.map((pa) => pa.name);
    });

    /*
     * Langsam herunterrollen, nicht springen. Jede Station muss zu 20 % ins
     * Bild geraten, damit ihr Beobachter auslöst — wer in einem Satz an den
     * Fuß springt, überspringt vier Auftritte und misst dann vier leere
     * Reihen.
     */
    const gesamt = await m.evaluate(() => document.body.scrollHeight - window.innerHeight);
    const schritte = 40;
    for (let i = 1; i <= schritte; i++) {
      await m.evaluate((y) => window.scrollTo(0, y), Math.round(gesamt * i / schritte));
      await m.waitForTimeout(220);
    }
    await m.waitForTimeout(2600);
    const proben = await m.evaluate(() => window.__proben);
    const bilder = await m.evaluate(() => window.__bilder);
    await m.close();

    const bildabstand = (() => {
      const d = bilder.slice(1).map((t, i) => t - bilder[i]).sort((x, y) => x - y);
      return d.length ? d[Math.floor(d.length / 2)] : NaN;
    })();

    const werte = [], gruende = [];
    proben.forEach((reihe, i) => {
      if (reihe.length === 0 || reihe[0][1] >= 0.5 || reihe[0][2] >= 0.5) {
        gruende.push(`${paare[i]}: zu_spaet_gemessen`);
        return;
      }
      const erste = (spalte) => {
        for (const pr of reihe) if (pr[spalte] >= 0.99) return pr[0];
        return null;
      };
      const tM = erste(1), tO = erste(2);
      if (tM === null || tO === null) { gruende.push(`${paare[i]}: unvollstaendig`); return; }
      werte.push({ name: paare[i], abstand: tO - tM });
    });
    return { soll, werte, gruende, bildabstand };
  }

  const echt = await versatzMessen(false);
  const ohne = await versatzMessen(true);
  const mittel = (xs) => xs.reduce((a2, b) => a2 + b, 0) / xs.length;
  /** Standardfehler des Mittelwerts — das Fehlermaß, ohne das keine Zahl gilt. */
  const fehlermass = (xs) => {
    if (xs.length < 2) return NaN;
    const m2 = mittel(xs);
    return Math.sqrt(xs.reduce((a2, b) => a2 + (b - m2) ** 2, 0) / (xs.length - 1) / xs.length);
  };
  const eW = echt.werte.map((w) => w.abstand), oW = ohne.werte.map((w) => w.abstand);
  zeile(`   Bildabstand im Mittel ${echt.bildabstand.toFixed(1)} ms`
    + ` — das Rauschen dieser Messung, nicht ihre Auflösung`);
  zeile(`   mit  ${echt.soll.toFixed(0)} ms: ${eW.map((v) => v.toFixed(0)).join(", ")}`
    + ` → ⌀ ${mittel(eW).toFixed(1)} ± ${fehlermass(eW).toFixed(1)} ms (${eW.length} Stationen)`);
  zeile(`   ohne (0 ms):     ${oW.map((v) => v.toFixed(0)).join(", ")}`
    + ` → ⌀ ${mittel(oW).toFixed(1)} ± ${fehlermass(oW).toFixed(1)} ms (${oW.length} Stationen)`);
  for (const g of [...echt.gruende, ...ohne.gruende]) zeile(`   verworfen — ${g}`);

  if (eW.length < 2 || oW.length < 2) {
    fehlt(`Versatz nicht messbar — zu_wenige_proben (${eW.length}/${oW.length} Stationen)`);
  } else {
    const rein = mittel(eW) - mittel(oW);
    const unsicher = Math.hypot(fehlermass(eW), fehlermass(oW));
    zeile(`   Kurvenanteil ⌀ ${mittel(oW).toFixed(1)} ms (fällt in der Differenz heraus)`
      + ` · Versatz allein ${rein.toFixed(1)} ± ${unsicher.toFixed(1)} ms,`
      + ` erklärt ${echt.soll.toFixed(0)} ms`);
    /*
     * Erst das Messgerät wiegen, dann das Gemessene beurteilen.
     *
     * Ist das Fehlermaß größer als die Grenze, sagt ein „passt" nichts aus —
     * es hieße nur, dass die Messung zu stumpf ist, um den Fehler zu finden,
     * den sie suchen soll. Dann ist der Befund die Stumpfheit, nicht der Wert.
     */
    const GRENZE = 1.5 * BILD_MS;
    if (!(unsicher <= GRENZE)) {
      fehlt(`Messung zu stumpf: Fehlermaß ±${unsicher.toFixed(1)} ms über der Grenze`
        + ` ±${GRENZE.toFixed(0)} ms — der Wert ${rein.toFixed(1)} ms wird nicht behauptet`);
    } else if (Math.abs(rein - echt.soll) <= GRENZE) {
      passt(`Marginalie führt um ${rein.toFixed(1)} ± ${unsicher.toFixed(1)} ms`
        + ` (erklärt ${echt.soll.toFixed(0)} ms, Grenze ±${GRENZE.toFixed(0)} ms)`);
    } else {
      fehlt(`Versatz ${rein.toFixed(1)} ± ${unsicher.toFixed(1)} ms statt ${echt.soll.toFixed(0)} ms`);
    }
  }

  /* ————————————————————— 3 · DIE STATIONEN ————————————————————— */
  zeile("\n── 3 · Die Stationen ──");
  const stationen = await seite.evaluate(() =>
    Array.from(document.querySelectorAll("[data-station]"), (el) => ({
      name: el.dataset.auftritt ?? el.className,
      y: Math.round(el.getBoundingClientRect().top + window.scrollY),
      hoehe: el.offsetHeight,
    })));
  zeile(`   ${stationen.length} Stationen gefunden`);
  for (const [i, st] of stationen.entries()) {
    await seite.evaluate((y) => window.scrollTo(0, y), st.y - Math.round(a.hoehe * 0.35));
    await seite.waitForTimeout(2600);
    const tot = await seite.evaluate((name) => {
      const el = Array.from(document.querySelectorAll("[data-station]"))
        .find((n) => (n.dataset.auftritt ?? n.className) === name);
      return Array.from(el.querySelectorAll("[data-rolle]"))
        .filter((n) => parseFloat(getComputedStyle(n).opacity) < 0.99)
        .map((n) => `${n.dataset.rolle} ${getComputedStyle(n).opacity}`);
    }, st.name);
    await schreiben(
      `${ORDNER}/${a.name}-3-station-${String(i + 1).padStart(2, "0")}-${st.name}.png`,
      await seite.screenshot());
    tot.length === 0
      ? passt(`${st.name} vollständig aufgetreten`)
      : fehlt(`${st.name}: ${tot.length} Kinder unsichtbar — ${tot.join(", ")}`);
  }

  /* ————————————————————— 4 · DAS SCHARNIER ————————————————————— */
  /*
   * ZWEI FRAGEN, NICHT EINE.
   *
   * Die erste ist die naheliegende: bewegt sich der Versatz über den Rollweg,
   * oder hängt der Auslöser? Die zweite ist die, die beim ersten Lauf gefehlt
   * hat: WO steht die Linie, wenn sie fertig ist?
   *
   * Die erste Fassung dieser Prüfung meldete für beide Pfade „wächst über den
   * Rollweg" und war zufrieden. Sie war es zu Unrecht: mit ScrollTriggers
   * Grundeinstellung `end: "bottom top"` wird eine Linie genau dann fertig,
   * wenn sie oben aus dem Bild gerollt ist. Gemessen: die Naht erreichte 0 bei
   * einer Schließstelle von −24 px. Der Kreis schloss sich bei jedem Besuch,
   * über der Fensterkante, unsichtbar. Ein grüner Haken auf einer Bewegung,
   * die niemand sehen kann — genau die Sorte Messung, die man nie bemerkt.
   */
  zeile("\n── 4 · Das Scharnier ──");
  const epochen = await seite.evaluate(() => {
    const el = document.querySelector(".epochen");
    return { y: Math.round(el.getBoundingClientRect().top + window.scrollY), h: el.offsetHeight };
  });
  const gesamthoehe = await seite.evaluate(() => document.body.scrollHeight - window.innerHeight);
  const spur = [];
  for (let i = 0; i <= 30; i++) {
    const y = Math.min(gesamthoehe,
      epochen.y - a.hoehe + Math.round((epochen.h + a.hoehe * 2) * i / 30));
    await seite.evaluate((z) => window.scrollTo(0, z), y);
    await seite.waitForTimeout(320);
    spur.push(await seite.evaluate(() => {
      const svg = document.querySelector(".scharnier");
      const k = svg.getBoundingClientRect();
      const zahl = (w) => parseFloat(getComputedStyle(document.querySelector(w)).strokeDashoffset);
      return {
        bahn: zahl(".scharnier-bahn"),
        naht: zahl(".scharnier-naht"),
        /*
         * Die Schließstelle: viewBox-y 900 von 1000, der tiefste Punkt der
         * Naht. Weil `preserveAspectRatio="none"` den Kasten streckt, ist sie
         * ein fester Anteil der SVG-Höhe und keine Bildpunktzahl.
         */
        schluss: Math.round(k.top + k.height * 0.9),
        /* Das Ende der Bahn: viewBox-y 620, wo sich die Zweige treffen. */
        gabel: Math.round(k.top + k.height * 0.62),
      };
    }));
  }
  zeile(`   Bahn ${spur.filter((_, i) => i % 6 === 0).map((v) => v.bahn.toFixed(0)).join(" → ")}`);
  zeile(`   Naht ${spur.filter((_, i) => i % 6 === 0).map((v) => v.naht.toFixed(0)).join(" → ")}`);
  for (const [name, holen, stelle] of [
    ["Bahn", (v) => v.bahn, (v) => v.gabel],
    ["Naht", (v) => v.naht, (v) => v.schluss],
  ]) {
    const werte = spur.map(holen);
    const spanne = Math.max(...werte) - Math.min(...werte);
    const faellt = werte.every((w, i) => i === 0 || w <= werte[i - 1] + 1);
    /*
     * Spanne 0 und Spanne voll sind BEIDE verdächtig — die eine heißt „der
     * Auslöser hängt", die andere „der Auslöser hat nie gegriffen und der
     * Endzustand steht seit dem Aufbau da". Geprüft wird der Verlauf.
     */
    if (spanne < 100) { fehlt(`${name}: Versatz bewegt sich kaum (Spanne ${spanne.toFixed(0)} von 1000)`); continue; }
    if (!faellt) { fehlt(`${name}: Versatz fällt nicht durchgehend — ${werte.map((w) => w.toFixed(0)).join(", ")}`); continue; }
    passt(`${name}: wächst über den Rollweg (Spanne ${spanne.toFixed(0)} von 1000)`);

    const fertig = spur.findIndex((v) => holen(v) <= 1);
    if (fertig < 0) {
      fehlt(`${name}: wird auf dem ganzen Rollweg nie fertig (kleinster Versatz`
        + ` ${Math.min(...werte).toFixed(0)}) — die Linie bleibt offen`);
      continue;
    }
    const wo = stelle(spur[fertig]);
    zeile(`   ${name} fertig, Endpunkt dann bei y=${wo} von ${a.hoehe} px Fensterhöhe`);
    (wo >= 0 && wo <= a.hoehe)
      ? passt(`${name}: wird im Bild fertig (Endpunkt y=${wo})`)
      : fehlt(`${name}: wird außerhalb des Bildes fertig (Endpunkt y=${wo}) —`
        + " die Bewegung läuft, aber niemand sieht ihren Schluss");
  }

  /* ————————————————————— Die Handlung ————————————————————— */
  const aktion = await seite.evaluate(() => {
    const el = document.querySelector(".aktion");
    return { y: Math.round(el.getBoundingClientRect().top + window.scrollY), luecke: el.dataset.luecke };
  });
  await seite.evaluate((y) => window.scrollTo(0, y), aktion.y - Math.round(a.hoehe * 0.2));
  await seite.waitForTimeout(2600);
  await schreiben(`${ORDNER}/${a.name}-6-handlung.png`, await seite.screenshot());
  zeile(`\n── 6 · Die Handlung ──`);
  zeile(`   offene Lücke: ${JSON.stringify(aktion.luecke)} — BEFUND, kein Fehler.`
    + " Text und Ziel stehen im Release als ERZEUGEN und werden nicht erfunden.");

  /* ————————————————————— Das Schlussbild der Bühne ————————————————————— */
  await rolleAufBuehne(seite, masse, 1);
  await seite.waitForTimeout(2600);
  await schreiben(`${ORDNER}/${a.name}-0-buehnenende.png`, await seite.screenshot());

  fehler.length === 0 ? passt("0 JS-Fehler") : fehlt(`${fehler.length} JS-Fehler: ${fehler[0]}`);
  await seite.close();
}

await browser.close();
zeile(`\n${offen === 0 ? "ALLES BELEGT" : `${offen} NICHT BELEGT`}`);
process.exit(offen === 0 ? 0 : 1);
