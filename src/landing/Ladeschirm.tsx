/**
 * Der Ladeschirm.
 *
 * NICHTS IST SCROLLBAR, BEVOR ALLE FRAMES DA SIND. Eine Sequenz, der Frames
 * fehlen, springt beim Scrollen — und ein Sprung sieht aus wie ein Fehler,
 * nicht wie ein Ladezustand. Der Ring sagt die ganze Zeit, wie weit er ist.
 *
 * Er zeigt einen Kreis, der sich schließt. Das Erste, was jemand von dieser
 * Marke sieht, ist damit dasselbe wie das Letzte.
 */
import { useEffect, useRef, useState } from "react";

/** Umfang des Kreises: 2·π·18 ≈ 113. Steht auch im `stroke-dasharray`. */
export const UMFANG = 113;

export function Ladeschirm({ anteil, fertig }: { anteil: number; fertig: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const [weg, setWeg] = useState(false);

  /*
   * Nach der Blende verschwindet der Ladeschirm aus dem DOM.
   *
   * Er ist eine feste Fläche über der ganzen Seite. Auch durchsichtig und
   * ohne Zeigerereignisse bleibt er ein Deckel, unter dem etwas hängenbleiben
   * kann. Gewartet wird auf das Ende der Blende, nicht auf eine abgezählte
   * Zeit: die Dauer steht im Stylesheet und darf sich dort ändern.
   */
  useEffect(() => {
    const knoten = el.current;
    if (!fertig || !knoten) return;
    const fertigMelden = () => setWeg(true);
    knoten.addEventListener("transitionend", fertigMelden, { once: true });
    return () => knoten.removeEventListener("transitionend", fertigMelden);
  }, [fertig]);

  if (weg) return null;

  return (
    <div ref={el} className="ladeschirm" data-fertig={fertig ? "ja" : "nein"} aria-hidden={fertig}>
      <svg viewBox="0 0 40 40" width="64" height="64" style={{ transform: "rotate(-90deg)" }}>
        <circle className="lade-bahn" cx="20" cy="20" r="18" />
        <circle
          className="lade-lauf"
          cx="20" cy="20" r="18"
          strokeDasharray={UMFANG}
          strokeDashoffset={UMFANG * (1 - anteil)}
          style={{ transition: "stroke-dashoffset var(--dauer-mikro) linear" }}
        />
      </svg>
      <span className="ladeschirm-zahl">{Math.round(anteil * 100)}</span>
    </div>
  );
}
