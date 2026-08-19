/**
 * AKT III — DER KREIS
 *
 * Ziel: Erkenntnis. Interaktion: der Nutzer rollt die Schlange selbst ein.
 *
 * Die Sequenz ist das rückwärts abgespielte AUFROLLEN — siehe
 * `scripts/sequenzen-bauen.mjs`. Dadurch steht der Kopf in jedem Frame auf
 * zwölf Uhr, vom ersten bis zum letzten. Die vorwärts erzeugte Fassung
 * rotierte das Tier und tauschte Kopf und Schwanzspitze.
 *
 * Am Ende frisst eine radiale Abdunklung den Rand, und aus der Fotografie
 * wird ein Zeichen. KEIN zweiter, freigestellter Ring darüber — das ergäbe
 * zwei Kreise. Der Ring im Bild IST das Logo.
 */
import { useEffect, useRef } from "react";
import { canvasSpannen, frameZu, naechstesBild, zeichneDeckend, type Sequenz } from "../motion/sequenz";
import { bereich, buehneBeobachten } from "../motion/buehne";
import { choreografie, FRAMES } from "./choreografie";
import { Standbild } from "./Standbild";

export function AktKreis(
  { seq, ruhig, aufFortschritt }: {
    seq: Sequenz | null;
    ruhig: boolean;
    aufFortschritt: (p: number) => void;
  },
) {
  const kasten = useRef<HTMLElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const dunkel = useRef<HTMLDivElement>(null);
  const siegel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ruhig || !kasten.current) return;
    const c = choreografie();
    let letzterFrame = -1;

    const stop = buehneBeobachten(kasten.current, (p) => {
      aufFortschritt(p);

      if (dunkel.current) {
        dunkel.current.style.opacity =
          String(bereich(p, c.akt3.dunkel[0], c.akt3.dunkel[1]));
      }
      if (siegel.current) {
        const a = bereich(p, c.akt3.siegel[0], c.akt3.siegel[1]);
        siegel.current.style.opacity = String(a);
        siegel.current.style.transform = `translateY(${(1 - a) * c.akt3.siegelWeg}px)`;
      }

      const cv = leinwand.current;
      if (!cv || !seq) return;
      // Das Einrollen ist vor dem Ende der Bühne fertig — danach bleibt der
      // Ring stehen, während sich die Abdunklung legt und das Siegel kommt.
      const lauf = bereich(p, c.akt3.rollen[0], c.akt3.rollen[1]);
      const index = frameZu(lauf, FRAMES);
      const neu = canvasSpannen(cv);
      if (index === letzterFrame && !neu) return;
      letzterFrame = index;
      const bild = naechstesBild(seq, index);
      if (bild) zeichneDeckend(cv, bild);
    });
    return stop;
  }, [seq, ruhig, aufFortschritt]);

  return (
    <section className="buehne buehne-3" ref={kasten} id="akt-kreis">
      <div className="bild">
        <Standbild
          name="ring"
          klasse="ebene ebene-bild"
          alt="Die Wüstenotter hat sich zum geschlossenen Ring eingerollt, der Kopf berührt den eigenen Schwanz."
        />
        {!ruhig && (
          <canvas
            ref={leinwand}
            className="ebene"
            role="img"
            aria-label="Die Wüstenotter rollt sich zum Ouroboros ein, gesteuert vom Scrollen."
          />
        )}

        {/*
          Der Schleier fehlte hier — das war schlicht vergessen, und der
          Bauauftrag verlangt ihn über JEDEM Bild. Ohne ihn stand der
          Kolumnentitel auf hellem Sand.
        */}
        <div className="ebene ebene-schleier" />

        <div ref={dunkel} className="ebene dunkel" style={{ opacity: 0 }} />

        <div className="ebene ebene-text" style={{ pointerEvents: "none" }}>
          <p
            className="kolumnentitel"
            style={{ position: "absolute", top: "clamp(18px, 3.4vw, 34px)", left: "clamp(18px, 5vw, 64px)" }}
          >
            Akt III — der Kreis
          </p>
          <div ref={siegel} className="siegel" style={{ opacity: 0 }}>
            <p className="siegel-marke" style={{ margin: 0 }}>OROBOROS</p>
            <p className="siegel-unter" style={{ margin: 0 }}>Design</p>
            <span className="siegel-strich" aria-hidden="true" />
            <p className="siegel-satz" style={{ margin: 0 }}>
              Die nächste Form ist nie die letzte.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
