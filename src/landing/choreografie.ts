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
    lockup: [zahl(s, "--lockup-von"), zahl(s, "--lockup-bis")],
    schrift: [zahl(s, "--schrift-von"), zahl(s, "--schrift-bis")],
    siegel: [zahl(s, "--siegel-von"), zahl(s, "--siegel-bis")],
    siegelSkala: zahl(s, "--siegel-skala"),
  };
}

/**
 * Die Anzahl Frames — von `scripts/sequenz-bauen.mjs` erzeugt.
 *
 * 100 Hauptfilm plus 50 Rückfahrt. Die Zahl steht hier und im Bauskript;
 * laufen sie auseinander, fehlt der Sequenz das Ende und `naechstesBild`
 * liefert null — sichtbar sofort, nicht erst in Produktion.
 */
export const FRAMES = 150;

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

/**
 * Wo der Ring im LETZTEN Frame steht — gemessen, nicht angenommen.
 *
 * Die Verwandlung am Ende muss den Ring des Tieres genau dorthin bringen, wo
 * im Wort das erste O stünde. Dafür braucht sie drei Zahlen je Satz: wo der
 * Ring sitzt und wie groß er ist. Beides ist eine Eigenschaft des Bildes, kein
 * Gestaltungswert — deshalb steht es hier und nicht in `bewegung.css`.
 *
 * GEMESSEN, WIE: über jedes `f150.webp` wurde eine Ellipse gelegt und so lange
 * nachgezogen, bis sie die Außenkante des Schlangenkörpers rundherum berührt
 * (`pruefstand/ringmass.mjs`). Die Aufnahmen liegen im Bericht.
 *
 * Der Bauauftrag nennt für „hoch" 0,570 und für „quer" 0,523 der Breite und
 * schreibt dazu „gemessen am letzten Frame der Rückfahrt". Beide Zahlen
 * stimmen — aber am ERSTEN Frame der Rückfahrt (f101: 3:4 senkrecht 0,5692,
 * 9:16 waagerecht 0,5310). Am letzten ist der Ring längst kleiner, denn genau
 * das tut eine Rückfahrt. Siehe Bericht.
 */
export interface Ringmass {
  /** Die Maße des Frames in Bildpunkten. */
  breite: number;
  hoehe: number;
  /** Mitte des Rings — Anteil der Bildbreite bzw. der Bildhöhe. */
  cx: number;
  cy: number;
  /** Außendurchmesser waagerecht, als Anteil der BILDBREITE. */
  d: number;
}

export const RING: Record<SatzName, Ringmass> = {
  "film-3x4":  { breite: 828,  hoehe: 1108, cx: 0.3825, cy: 0.5574, d: 0.2342 },
  "film-9x16": { breite: 716,  hoehe: 1284, cx: 0.3815, cy: 0.5985, d: 0.1982 },
  "film-16x9": { breite: 1284, hoehe: 716,  cx: 0.4935, cy: 0.4977, d: 0.2332 },
};
