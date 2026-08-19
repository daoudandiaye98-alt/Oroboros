/**
 * Der Ladeschirm.
 *
 * KEINE BÜHNE STARTET HALB GELADEN. Eine Sequenz, der Frames fehlen, springt
 * beim Scrollen — und ein Sprung sieht aus wie ein Fehler, nicht wie ein
 * Ladezustand. Deshalb wird Akt I vollständig geladen, bevor überhaupt etwas
 * zu sehen ist, und der Ladering sagt die ganze Zeit, wie weit er ist.
 *
 * Er zeigt denselben Kreis wie die Navigation. Das erste, was der Nutzer von
 * der Marke sieht, ist ein Kreis, der sich schließt.
 */
import { useEffect, useRef, useState } from "react";
import { UMFANG } from "./Fortschrittsring";

export function Ladeschirm({ anteil, fertig }: { anteil: number; fertig: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const [weg, setWeg] = useState(false);

  /*
   * Nach der Blende verschwindet der Ladeschirm aus dem DOM.
   *
   * Er ist eine feste Fläche über der ganzen Seite mit z-index 50. Auch
   * durchsichtig und ohne Zeigerereignisse bleibt er ein Deckel, unter dem
   * später etwas hängenbleiben kann — und er hielt bis eben eine zweite
   * `.ring-lauf` im Dokument, über die der eigene Selbsttest gestolpert ist.
   * Gewartet wird auf das Ende der Blende, nicht auf eine abgezählte Zeit:
   * die Dauer steht im Stylesheet und darf sich dort ändern.
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
