/**
 * Die Choreografie-Werte, gelesen statt geschrieben.
 *
 * Jede Zahl kommt aus `src/styles/bewegung.css`. Diese Datei ist die Brücke —
 * dasselbe Verhältnis wie `motion/tokens.ts` zu den Dauern und Kurven. Im
 * Komponentencode steht danach kein einziger Bewegungswert mehr.
 *
 * Gelesen wird bei jedem Aufruf frisch, aus demselben Grund wie in
 * `tokens.ts`: `prefers-reduced-motion` und der Schalter am Wurzelelement
 * können die Werte umstellen, und ein eingefrorener Wert wüsste davon nichts.
 */

function zahl(stil: CSSStyleDeclaration, name: string): number {
  const roh = stil.getPropertyValue(name).trim();
  const wert = parseFloat(roh);
  return Number.isFinite(wert) ? wert : 0;
}

/** Ein Fenster im Fortschritt: von … bis. */
export type Fenster = [number, number];

export interface Choreografie {
  /** In welchem Fenster läuft der Film ab? */
  film: Fenster;
  /** Wann blendet der Rollhinweis aus? */
  hinweis: Fenster;
  /** Wann blendet die Wortmarke aus, und wie weit zieht sie dabei? */
  marke: Fenster;
  markeWeg: number;
  /** Wann legt sich die flächige Abdunklung? */
  dunkel: Fenster;
  /** Wann kommt das Siegel, und aus welchem Maßstab? */
  siegel: Fenster;
  siegelSkala: number;
}

export function choreografie(): Choreografie {
  const s = getComputedStyle(document.documentElement);
  return {
    film: [zahl(s, "--film-von"), zahl(s, "--film-bis")],
    hinweis: [zahl(s, "--hinweis-von"), zahl(s, "--hinweis-bis")],
    marke: [zahl(s, "--marke-von"), zahl(s, "--marke-bis")],
    markeWeg: zahl(s, "--marke-weg"),
    dunkel: [zahl(s, "--dunkel-von"), zahl(s, "--dunkel-bis")],
    siegel: [zahl(s, "--siegel-von"), zahl(s, "--siegel-bis")],
    siegelSkala: zahl(s, "--siegel-skala"),
  };
}

/** Die Anzahl Frames — von `scripts/sequenz-bauen.mjs` erzeugt. */
export const FRAMES = 40;

/** Der Name der einen Sequenz unter `public/seq/`. */
export const SEQUENZ = "film-p";
