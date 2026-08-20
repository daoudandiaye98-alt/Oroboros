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
  /** Wann wandert der Ausschnitt, bis der Ring das erste O ist? */
  lockup: Fenster;
  /** Wann treten die sieben Buchstaben einzeln dazu? */
  schrift: Fenster;
  /** Wann kommt das Siegel, und aus welcher Höhe steigt es? */
  siegel: Fenster;
  siegelWeg: number;
}

export function choreografie(): Choreografie {
  const s = getComputedStyle(document.documentElement);
  return {
    film: [zahl(s, "--film-von"), zahl(s, "--film-bis")],
    hinweis: [zahl(s, "--hinweis-von"), zahl(s, "--hinweis-bis")],
    marke: [zahl(s, "--marke-von"), zahl(s, "--marke-bis")],
    markeWeg: zahl(s, "--marke-weg"),
    lockup: [zahl(s, "--lockup-von"), zahl(s, "--lockup-bis")],
    schrift: [zahl(s, "--schrift-von"), zahl(s, "--schrift-bis")],
    siegel: [zahl(s, "--siegel-von"), zahl(s, "--siegel-bis")],
    siegelWeg: zahl(s, "--siegel-weg"),
  };
}

/*
 * HIER STAND `FRAMES`.
 *
 * Die Zahl ist mit dem Kontinuitäts-Auftrag entfallen, und das ist kein
 * Aufräumen: wie viele Frames eine Bühne braucht, hängt seit der Umstellung
 * auf Kamerafahrt vom FENSTER ab. Auf 1440 × 900 endet sie bei Frame 141, auf
 * 390 × 844 bei 161. Eine feste Zahl hätte entweder zu früh geendet — dann
 * steht der Ring falsch — oder zu viel geladen. Gerechnet wird sie in
 * `kamera.ts` aus `ring.json`.
 */


/** Jeder wievielte Frame steckt im Vorlauf. Muss zum Bauskript passen. */
export const VORLAUF_SCHRITT = 4;

/**
 * Die Formatsätze.
 *
 * Ausgewählt wird EINMAL beim Laden über `matchMedia`. Kein Nachladen beim
 * Drehen: den zweiten Satz mitten in der Sitzung zu holen hieße, hundertfünfzig
 * Bilder anzufordern, während jemand gerade schaut. Der geladene Satz läuft
 * per `cover` weiter — das schneidet, aber es stockt nicht.
 *
 * Drei Sätze, weil zwei nicht reichten. Ein Telefon im Hochformat ist heute
 * 9:19,5 und nicht 3:4; der 3:4-Satz füllte es nur mit einem Schnitt, der
 * links und rechts ein Fünftel des Bildes wegnahm. Die Grenze liegt bei 3/4:
 * schmaler als das bekommt 9:16, breiter das ursprüngliche 3:4.
 */
export const SAETZE = {
  schmal: "film-9x16",
  hoch: "film-3x4",
  quer: "film-16x9",
} as const;

export type SatzName = typeof SAETZE[keyof typeof SAETZE];

export function satzWaehlen(): SatzName {
  if (!window.matchMedia("(orientation: portrait)").matches) return SAETZE.quer;
  return window.matchMedia("(max-aspect-ratio: 3/4)").matches ? SAETZE.schmal : SAETZE.hoch;
}
