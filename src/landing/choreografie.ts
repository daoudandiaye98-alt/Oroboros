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
export const FRAMES = 100;

/** Jeder wievielte Frame steckt im Vorlauf. Muss zum Bauskript passen. */
export const VORLAUF_SCHRITT = 4;

/**
 * Die Formatsätze.
 *
 * Ausgewählt wird EINMAL beim Laden über `matchMedia`. Kein Nachladen beim
 * Drehen: den zweiten Satz mitten in der Sitzung zu holen hieße, hundert
 * Bilder anzufordern, während jemand gerade schaut. Der geladene Satz läuft
 * per `cover` weiter — das schneidet, aber es stockt nicht.
 *
 * ES FEHLT EIN DRITTER SATZ. Für das Telefon im Hochformat (9:19,5) bräuchte
 * es 9:16-Material; 3:4 füllt ein solches Display nicht ohne Schnitt.
 * Solange er fehlt, bekommt das Telefon den 3:4-Satz — sichtbar besser als
 * vorher, aber nicht formatgerecht. Nichts wird dafür nachgeneriert: das
 * bräche die Referenzverriegelung des Tieres.
 */
export const SAETZE = {
  hoch: "film-3x4",
  quer: "film-16x9",
} as const;

export type SatzName = typeof SAETZE[keyof typeof SAETZE];

export function satzWaehlen(): SatzName {
  return window.matchMedia("(orientation: portrait)").matches ? SAETZE.hoch : SAETZE.quer;
}
