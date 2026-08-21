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
  /** Wann steht die eine Zeile, die vom Sturm zum Ring führt? */
  bruecke: Fenster;
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
    bruecke: [zahl(s, "--bruecke-von"), zahl(s, "--bruecke-bis")],
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
 * ZWEI SÄTZE, NICHT DREI — und der dritte ist nicht aus Sparsamkeit gefallen.
 *
 * Der Prolog liegt in 3:4 und 16:9 vor, und ein eigener 9:16-Prolog wäre neues
 * Material. Ein schmales Telefon, das den Prolog in 3:4 sieht und danach die
 * Heldensequenz in 9:16, bekommt an der Fuge einen Schnitt: dieselbe Szene,
 * zwei verschiedene Aufnahmen, die Schlange einmal nach links und einmal nach
 * rechts. Gemessen auf 390 × 844 sind das 16,7 von 255 — über der Schwelle von
 * 12, die für den ganzen Prolog gilt. Mit dem 3:4-Satz sind es 3,1.
 *
 * Der Preis ist der Beschnitt: `cover` nimmt einem 3:4-Bild auf 390 × 844
 * 38 % der Breite. Er kostet die Komposition nichts — das Tier steht mittig —
 * und er ist der Grund, warum das Lockup dort überhaupt zentriert stehen kann:
 * dieser Beschnitt IST die Overscan-Reserve, aus der der Schwenk kommt.
 */
export const SAETZE = {
  hoch: "film-3x4",
  quer: "film-16x9",
} as const;

export type SatzName = typeof SAETZE[keyof typeof SAETZE];

export function satzWaehlen(): SatzName {
  return window.matchMedia("(orientation: portrait)").matches ? SAETZE.hoch : SAETZE.quer;
}

/** Welcher Prologfilm zu einem Satz gehört. */
export function prologFilm(satz: SatzName): "3x4" | "16x9" {
  return satz === SAETZE.hoch ? "3x4" : "16x9";
}
