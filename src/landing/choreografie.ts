/**
 * Die Choreografie-Werte, gelesen statt geschrieben.
 *
 * Jede Zahl kommt aus `src/styles/bewegung.css`. Diese Datei ist die Brücke —
 * dasselbe Verhältnis wie `motion/tokens.ts` zu den Dauern und Kurven. Im
 * Komponentencode steht danach kein einziger Bewegungswert mehr, und wer die
 * Seite umtaktet, öffnet keine .tsx.
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

export interface Choreografie {
  akt1: {
    kopfZoom: number;
    markeWeg: number;
    markeAus: [number, number];
    sequenzAb: number;
  };
  akt2: {
    zeileWeg: number;
    zeileAus: [number, number];
    karteWeg: number;
    karteVon: number;
    karteBis: number;
    karteVersatz: number;
  };
  akt3: {
    rollen: [number, number];
    dunkel: [number, number];
    siegel: [number, number];
    siegelWeg: number;
  };
  ring: [number, number, number];
}

export function choreografie(): Choreografie {
  const s = getComputedStyle(document.documentElement);
  return {
    akt1: {
      kopfZoom: zahl(s, "--akt1-kopf-zoom"),
      markeWeg: zahl(s, "--akt1-marke-weg"),
      markeAus: [zahl(s, "--akt1-marke-aus-von"), zahl(s, "--akt1-marke-aus-bis")],
      sequenzAb: zahl(s, "--akt1-sequenz-ab"),
    },
    akt2: {
      zeileWeg: zahl(s, "--akt2-zeile-weg"),
      zeileAus: [zahl(s, "--akt2-zeile-aus-von"), zahl(s, "--akt2-zeile-aus-bis")],
      karteWeg: zahl(s, "--akt2-karte-weg"),
      karteVon: zahl(s, "--akt2-karte-von"),
      karteBis: zahl(s, "--akt2-karte-bis"),
      karteVersatz: zahl(s, "--akt2-karte-versatz"),
    },
    akt3: {
      rollen: [zahl(s, "--akt3-rollen-von"), zahl(s, "--akt3-rollen-bis")],
      dunkel: [zahl(s, "--akt3-dunkel-von"), zahl(s, "--akt3-dunkel-bis")],
      siegel: [zahl(s, "--akt3-siegel-von"), zahl(s, "--akt3-siegel-bis")],
      siegelWeg: zahl(s, "--akt3-siegel-weg"),
    },
    ring: [zahl(s, "--ring-akt1"), zahl(s, "--ring-akt2"), zahl(s, "--ring-akt3")],
  };
}

/** Die Anzahl Frames je Sequenz — von `scripts/sequenzen-bauen.mjs` erzeugt. */
export const FRAMES = 61;

/** Der geladene Formatsatz. Einmal beim Start bestimmt, siehe `Landing.tsx`. */
export type Satz = "p" | "l";
