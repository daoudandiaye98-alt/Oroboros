/**
 * Der Fortschrittsring — die Navigation IST die Aussage.
 *
 * Rechts mittig, 40 px. Er füllt sich über die ganze Seite und ist am Ende
 * GESCHLOSSEN. Das ist kein Zierrat: die Marke behauptet den Kreis, und statt
 * das in einem Satz zu erklären, schließt ihn die Navigation vor den Augen
 * des Nutzers. Philosophie wird erfahren, nicht erklärt.
 *
 * Aktualisiert wird über zwei direkte DOM-Schreibvorgänge, nicht über
 * React-Zustand: bei sechzig Bildern je Sekunde wäre jedes `setState` ein
 * kompletter Renderdurchlauf für zwei geänderte Zahlen. Deshalb reicht der
 * Aufrufer seine Refs herein.
 *
 * Beide Refs sind gewöhnliche Props und nicht `forwardRef`: seit React 19 ist
 * `ref` ein normaler Prop, und zwei benannte Props sind hier ohnehin ehrlicher
 * als ein anonymer weitergereichter plus ein zweiter mit eigenem Namen.
 */
import type { RefObject } from "react";

/** Umfang des Kreises: 2·π·18 ≈ 113. Steht auch im `stroke-dasharray`. */
export const UMFANG = 113;

export function Fortschrittsring(
  { laufRef, schriftRef }: {
    laufRef: RefObject<SVGCircleElement | null>;
    schriftRef: RefObject<HTMLSpanElement | null>;
  },
) {
  return (
    <div className="ring" aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <circle className="ring-bahn" cx="20" cy="20" r="18" />
        <circle
          ref={laufRef}
          className="ring-lauf"
          cx="20" cy="20" r="18"
          strokeDasharray={UMFANG}
          strokeDashoffset={UMFANG}
        />
      </svg>
      <span className="ring-schrift" ref={schriftRef}>I</span>
    </div>
  );
}
