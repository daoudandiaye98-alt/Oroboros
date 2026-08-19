/**
 * Der Beleg — die vier Blöcke der Werkstatt einzeln, mit Zahlen und je zwei
 * Aufnahmen, einmal normal und einmal mit umgelegtem Schalter.
 *
 *   node pruefstand/beleg.mjs <ordner>
 *
 * Warum neben dem Prüfstand: der Prüfstand misst die Seite gegen die
 * ZERA-Kontrollen — er sagt, ob sie trägt. Er sagt NICHT, ob der Spalter
 * spaltet und ob die Bewegung linear ist. Das hier ist die Gegenprobe der
 * WERKZEUGE, und sie gehört zum Template: wer forkt, kann in einer Minute
 * nachsehen, ob die Bewegungssprache in seiner Kopie noch stimmt.
 *
 * Wie der Prüfstand: es wird gemessen und gedruckt, nicht bewertet. Der
 * Rückgabewert ist immer 0 — wer eine Zahl falsch findet, sagt das selbst.
 *
 * Voraussetzung: ein laufender Server auf 127.0.0.1:4173
 *   npm run build && npx vite preview --port 4173
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASIS = "http://127.0.0.1:4173/werkstatt";
const ORDNER = process.argv[2];
mkdirSync(ORDNER, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });
const zeile = (...a) => console.log(...a);
const KLAPPE = { width: 1280, height: 900 };

/**
 * Eine frische Seite. `still` legt den SCHALTER oben rechts um — nicht eine
 * Klasse von aussen. Genau das verlangt die Abnahme: der Fallback wird über
 * den Weg geprüft, den ein Mensch nimmt, nicht über einen Sondereingang.
 */
async function neu(still) {
  const page = await browser.newPage({ viewport: KLAPPE, locale: "de-DE" });
  await page.goto(BASIS, { waitUntil: "domcontentloaded" });
  if (still) {
    await page.getByRole("button", { name: /Bewegung reduzieren/ }).click();
    const an = await page.evaluate(() =>
      document.documentElement.classList.contains("ruhige-bewegung"));
    if (!an) throw new Error("Schalter hat die Klasse nicht gesetzt");
  }
  return page;
}

/* ——— 0. Der Vorzustand kommt aus dem MARKUP, nicht aus einem Nachgriff ——— */
{
  const page = await browser.newPage({ viewport: KLAPPE });
  await page.goto(BASIS, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  // Die Karten stehen unter der Falz. Ihr Auftritt ist noch nicht gelaufen —
  // was hier steht, hat also NIEMAND per JavaScript gesetzt.
  const vor = await page.$$eval('[data-rolle="karte"]', (k) => k.map((el) => ({
    klasse: el.className,
    deckkraft: getComputedStyle(el).opacity,
    inline: el.style.opacity || "(keiner)",
  })));
  zeile("0 · Vorzustand vor dem Auftritt (Karten unter der Falz, 1,5 s nach dem Laden)");
  for (const v of vor) {
    zeile(`   class="${v.klasse}" → berechnete Deckkraft ${v.deckkraft}, Inline-Wert: ${v.inline}`);
  }
  zeile("   → die Null kommt aus der Klasse im Markup. GSAP hat das Element nie angefasst.");
  await page.close();
}

for (const still of [false, true]) {
  const marke = still ? "ruhig" : "normal";
  zeile(`\n═════ ${marke.toUpperCase()} ═════`);

  /* ——— A: Spalter + Auftritt wortweise ——— */
  {
    const page = await neu(still);
    const a = 'p[data-rolle="schlagzeile"]';
    await page.waitForSelector(`${a} .teil`, { timeout: 5000 });
    await page.waitForTimeout(120);
    const waehrend = await page.$$eval(`${a} .teil`, (t) => t.map((x) => +getComputedStyle(x).opacity));
    await page.screenshot({ path: `${ORDNER}/A-vorher-${marke}.png`, clip: { x: 0, y: 0, ...KLAPPE } });
    await page.waitForTimeout(3200);
    const nachher = await page.$$eval(`${a} .teil`, (t) => t.map((x) => +getComputedStyle(x).opacity));
    await page.screenshot({ path: `${ORDNER}/A-nachher-${marke}.png`, clip: { x: 0, y: 0, ...KLAPPE } });
    const dom = await page.$eval(a, (el) => ({
      label: el.getAttribute("aria-label"),
      teile: el.querySelectorAll(".teil").length,
      versteckt: el.querySelectorAll('.teil[aria-hidden="true"]').length,
      luecken: Array.from(el.childNodes).filter((n) => n.nodeType === 3 && /^\s+$/.test(n.textContent)).length,
      luekeInnen: Array.from(el.querySelectorAll(".teil")).some((t) => /\s/.test(t.textContent)),
      transform: Array.from(el.querySelectorAll(".teil")).slice(0, 3).map((t) => t.style.transform || "keins"),
      html: el.outerHTML.slice(0, 190),
    }));
    zeile("A · split.ts + reveal.ts");
    zeile("   Teile:", dom.teile, "| aria-hidden=\"true\":", dom.versteckt,
      "| aria-label:", JSON.stringify(dom.label));
    zeile("   Leerzeichen als nackte Textknoten:", dom.luecken,
      "| Leerzeichen INNERHALB eines .teil:", dom.luekeInnen);
    zeile("   Deckkraft 120 ms nach dem Start:", waehrend.slice(0, 6).join(", "), "…");
    zeile("   Deckkraft am Ende:", [...new Set(nachher)].join(","),
      "| transform der ersten drei Teile:", dom.transform.join(" · "));
    zeile("   DOM:", dom.html.replace(/\s+/g, " "));
    await page.close();
  }

  /* ——— B: Karten-Staffel ——— */
  {
    const page = await neu(still);
    await page.waitForTimeout(60);
    await page.evaluate(() => document.querySelectorAll("section")[1].scrollIntoView());
    await page.waitForTimeout(120);
    const waehrend = await page.$$eval('[data-rolle="karte"]', (k) => k.map((x) => +getComputedStyle(x).opacity));
    await page.screenshot({ path: `${ORDNER}/B-vorher-${marke}.png` });
    await page.waitForTimeout(3200);
    const nachher = await page.$$eval('[data-rolle="karte"]', (k) => k.map((x) => ({
      o: +getComputedStyle(x).opacity, t: x.style.transform || "keins" })));
    await page.screenshot({ path: `${ORDNER}/B-nachher-${marke}.png` });
    zeile("B · reveal.ts · Karten-Staffel");
    zeile("   Deckkraft im Lauf:", waehrend.join(", "));
    zeile("   Deckkraft am Ende:", nachher.map((x) => x.o).join(", "),
      "| transform:", nachher.map((x) => x.t).join(" · "));
    await page.close();
  }

  /* ——— C: scrubbe mit pin ——— */
  {
    const page = await neu(still);
    await page.waitForTimeout(800);
    const spacer = await page.$$eval(".pin-spacer", (n) => n.length);
    // Die Strecke wird nicht geraten, sondern am DOM abgelesen: der Anfang ist
    // der obere Rand der Bühne (bzw. ihres Abstandhalters), die Länge ein
    // Bildschirm. Feste Zahlen wären beim ersten Layoutwechsel falsch — und
    // hätten dann „keine Bewegung" gemeldet, wo nur woanders gemessen wurde.
    const start = await page.evaluate(() => {
      const b = document.querySelector("[data-buehne]");
      const halter = b?.closest(".pin-spacer") ?? b;
      return Math.round(halter.getBoundingClientRect().top + window.scrollY);
    });
    const schritt = await page.evaluate(() => Math.round(window.innerHeight / 4));
    const punkte = [];
    for (const y of [start, start + schritt, start + 2 * schritt, start + 3 * schritt, start + 4 * schritt]) {
      await page.evaluate((z) => window.scrollTo(0, z), y);
      await page.waitForTimeout(600);
      punkte.push(await page.evaluate(() => ({
        y: Math.round(window.scrollY),
        x: document.querySelector("[data-buehne] > div")?.style.transform || "keins",
      })));
      if (y === start) await page.screenshot({ path: `${ORDNER}/C-vorher-${marke}.png` });
    }
    await page.screenshot({ path: `${ORDNER}/C-nachher-${marke}.png` });
    zeile("C · scrub.ts · pin über 100 vh");
    zeile("   pin-spacer im DOM:", spacer, spacer ? "(Auslöser erzeugt)" : "(KEIN Auslöser erzeugt)");
    for (const p of punkte) zeile(`   scrollY ${String(p.y).padStart(4)} → ${p.x}`);
    await page.close();
  }

  /* ——— D: lerp ——— */
  {
    const page = await neu(still);
    await page.waitForTimeout(600);
    const punkt = 'main > div[aria-hidden="true"]';
    await page.mouse.move(200, 200);
    await page.waitForTimeout(900);
    const ruhe = await page.$eval(punkt, (el) => el.style.transform);
    await page.screenshot({ path: `${ORDNER}/D-vorher-${marke}.png` });
    await page.mouse.move(1000, 700);
    const spur = [];
    for (const ms of [50, 100, 200, 400]) {
      await page.waitForTimeout(ms - (spur.length ? [50, 100, 200][spur.length - 1] : 0));
      spur.push(`${String(ms).padStart(3)} ms: ${await page.$eval(punkt, (el) => el.style.transform)}`);
    }
    await page.screenshot({ path: `${ORDNER}/D-nachher-${marke}.png` });
    await page.waitForTimeout(1500);
    const an = await page.$eval(punkt, (el) => el.style.transform);
    zeile("D · lerp.ts · Nachziehen");
    zeile("   Zeiger ruht bei 200,200 → Punkt:", ruhe);
    zeile("   Zeiger springt auf 1000,700:");
    for (const s of spur) zeile("     ", s);
    zeile("   nach 1,9 s:", an, "(angekommen)");
    await page.close();
  }
}

await browser.close();
