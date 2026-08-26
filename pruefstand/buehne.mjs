/**
 * Der Rollweg DER BÜHNE — nicht der der Seite.
 *
 * Bis Phase 1 waren beide dasselbe: die Landing bestand aus einer einzigen
 * 420 svh hohen Bühne, und `document.body.scrollHeight - innerHeight` war
 * deren Weg. Seit unter der Bühne noch zwei Abschnitte liegen, ist das falsch
 * — und zwar auf die gefährliche Art: die Rechnung liefert weiterhin eine
 * Zahl, nur zeigt `p = 1` jetzt auf den Fuß der Handlung statt auf das
 * Schlussbild. Ein Prüfstand, der an der falschen Stelle fotografiert, meldet
 * „Ring fehlt", wo der Ring zwei Bildschirme weiter oben steht.
 *
 * Gemessen wird deshalb gegen dasselbe Element, gegen das auch die Laufzeit
 * misst: `buehneBeobachten(.buehne)` in `src/motion/buehne.ts`. Eine Bühne,
 * zwei Leser, eine Rechnung.
 *
 * Kein Ersatzwert, wenn die Bühne fehlt: dann ist die Seite nicht die, für
 * die dieser Prüfstand gebaut wurde, und ein stiller Rückfall auf die
 * Seitenhöhe wäre genau die Messung, die niemand mehr hinterfragt.
 */

/** `{ oben, weg }` der Bühne in Dokumentkoordinaten. */
export async function buehnenweg(page) {
  return page.evaluate(() => {
    const b = document.querySelector(".buehne");
    if (!b) throw new Error("Keine .buehne gefunden — gegen was soll hier gemessen werden?");
    const k = b.getBoundingClientRect();
    return {
      oben: Math.round(k.top + window.scrollY),
      weg: Math.max(0, b.offsetHeight - window.innerHeight),
      seite: document.body.scrollHeight - window.innerHeight,
    };
  });
}

/** Rollt auf den Anteil `p` (0…1) DER BÜHNE und gibt die Zielhöhe zurück. */
export async function rolleAufBuehne(page, masse, p) {
  const y = masse.oben + Math.round(masse.weg * p);
  await page.evaluate((z) => window.scrollTo(0, z), y);
  return y;
}

/**
 * Warten, bis die Bühne wirklich frei ist — und nicht, bis ein Element fehlt,
 * das es ohnehin nicht mehr gibt.
 *
 * Bis hierher stand in jedem Prüfskript diese Zeile:
 *
 *     waitForFunction(() => document.querySelector(".ladeschirm") === null)
 *
 * `.ladeschirm` kommt in `src/` an keiner einzigen Stelle mehr vor. Die
 * Bedingung war also beim ersten Aufruf erfüllt, die Wartezeit betrug null,
 * und was danach kam, waren die 2,5 s `waitForTimeout` dahinter. Der Prolog
 * läuft aber 15,6 s (gemessen, 1440 × 900, gzip-Server): jede Aufnahme, die
 * so entstand, zeigt den Prolog — und jede Pixelmessung darauf hat den
 * Prolog vermessen und das Ergebnis der Seite zugeschrieben.
 *
 * Gefunden wurde es nicht am Zahlenwert, sondern am Bild: die Fugenmessung
 * meldete tadellose 1,23 von 255 und das dazugehörige Bild zeigte Sand statt
 * einer Kante. Ein Beleg, den man ansieht, statt ihn abzulegen.
 *
 * Gewartet wird jetzt auf den Zustand selbst: der Prolog ist aus dem DOM.
 * Bleibt er stehen, wird geworfen — ein stiller Rückfall auf „dann eben
 * weiter" wäre genau der Fehler noch einmal.
 */
export async function warteAufBuehne(page, geduldMs = 120_000) {
  await page.waitForFunction(() => document.querySelector(".prolog") === null,
    null, { timeout: geduldMs });
  // Die Bühne muss danach auch dastehen. Ohne sie misst niemand irgendwas.
  await page.waitForSelector(".buehne", { timeout: 10_000 });
}
