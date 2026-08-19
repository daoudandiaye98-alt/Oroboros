/**
 * AKT I — DER KOPF
 *
 * Ziel: Blickkontakt. Emotion: Stillstand vor der Bewegung. Fokus: das Auge.
 * Interaktion: die erste Scrollgeste weckt das Tier.
 *
 * Der Aufbau ist ein Z-Sandwich — dieselbe Aufnahme zweimal, die Wortmarke
 * dazwischen:
 *
 *   z1 Grund       das ganze Bild
 *   z2 Schleier    damit der Text unten steht
 *   z3 Wortmarke   OROBOROS, zeichenweise
 *   z4 Kopf        dieselbe Aufnahme, bei 41 % beschnitten
 *
 * Die Hörner bleiben dadurch HINTER den Buchstaben, die Kopfmasse davor. Das
 * ist der ganze Effekt, und er kostet kein Alpha-PNG und keine Freistellung.
 *
 * Ab `--akt1-sequenz-ab` löst der Canvas das Standbild ab: das Tier atmet,
 * solange gescrollt wird. Nicht vorher — im Ruhezustand soll es still stehen.
 */
import { useEffect, useRef } from "react";
import { canvasSpannen, frameZu, naechstesBild, zeichneDeckend, type Sequenz } from "../motion/sequenz";
import { bereich, buehneBeobachten } from "../motion/buehne";
import { choreografie, FRAMES } from "./choreografie";
import { Standbild } from "./Standbild";
import { Wortmarke } from "./Wortmarke";

export function AktKopf(
  { seq, auf, ruhig, aufFortschritt, weiter }: {
    seq: Sequenz | null;
    auf: boolean;
    ruhig: boolean;
    aufFortschritt: (p: number) => void;
    weiter: () => void;
  },
) {
  const kasten = useRef<HTMLElement>(null);
  const kopf = useRef<HTMLDivElement>(null);
  const marke = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ruhig || !kasten.current) return;
    const c = choreografie();
    let letzterFrame = -1;

    const stop = buehneBeobachten(kasten.current, (p) => {
      aufFortschritt(p);

      // Der Kopf kommt näher. Beide Ebenen zusammen, damit der Schnitt bei
      // 41 % nicht auseinanderläuft.
      const zoom = `scale(${1 + p * c.akt1.kopfZoom})`;
      if (kopf.current) kopf.current.style.transform = zoom;

      // Die Wortmarke zieht nach oben weg und verschwindet, bevor die Bühne endet.
      if (marke.current) {
        const aus = bereich(p, c.akt1.markeAus[0], c.akt1.markeAus[1]);
        marke.current.style.transform = `translateY(${-p * c.akt1.markeWeg}px)`;
        marke.current.style.opacity = String(1 - aus);
      }

      // Die Sequenz übernimmt.
      const cv = leinwand.current;
      if (!cv || !seq) return;
      const an = p >= c.akt1.sequenzAb;
      cv.style.opacity = an ? "1" : "0";
      if (!an) return;
      const lauf = bereich(p, c.akt1.sequenzAb, 1);
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
    <section className="buehne buehne-1" ref={kasten} id="akt-kopf">
      <div className="bild">
        {/* z1 — der Grund: das ganze Bild, Himmel oben */}
        <div ref={kopf} className="ebene" style={{ willChange: "transform" }}>
          <Standbild
            name="hero"
            klasse={`ebene ebene-bild zoomt${auf ? " auf" : ""}`}
            alt="Eine Wüstenotter blickt frontal in die Kamera, dahinter die Düne im Abendlicht."
          />
          {/*
            Die Sequenz liegt über dem Standbild, nicht an seiner Stelle:
            solange sie unsichtbar ist, trägt das Standbild die Bühne. So ist
            zu keinem Zeitpunkt eine leere Fläche zu sehen — auch nicht im
            Moment des Umschaltens.
          */}
          {!ruhig && (
            <canvas
              ref={leinwand}
              className="ebene"
              role="img"
              aria-label="Die Wüstenotter atmet und züngelt, während die Seite rollt."
              style={{ opacity: 0, transition: "opacity var(--dauer-block) var(--kurve-marke)" }}
            />
          )}
        </div>

        {/* z2 — die Wortmarke, hinter dem Kopf */}
        <div className="ebene ebene-marke" ref={marke}>
          <Wortmarke text="OROBOROS" auf={auf} />
        </div>

        {/* z3 — derselbe Kopf, beschnitten, VOR der Wortmarke */}
        <div className="ebene ebene-vorn kopf-vorn" style={{ willChange: "transform" }}>
          <Standbild
            name="hero"
            klasse={`ebene ebene-bild zoomt${auf ? " auf" : ""}`}
            alt=""
          />
        </div>

        {/*
          z4 — der Schleier, ÜBER beiden Bildebenen.
          ABWEICHUNG: der Bauauftrag stellt ihn auf z2, also zwischen Grund und
          Kopf. Dann liegt er aber nur auf der oberen Hälfte des Bildes, und an
          der Schnittkante bei 41 % steht eine sichtbare waagerechte Naht — die
          untere Hälfte ist heller als die obere, obwohl es dasselbe Bild ist.
          Auf der Aufnahme 1440 × 900 zog sie quer durch das ganze Bild.
          Über beiden Ebenen deckt er gleichmäßig und die Naht verschwindet.
          Für die Lesbarkeit der Wortmarke ändert das nichts: sie steht in
          beiden Fällen vor dem geschleierten Himmel.
        */}
        <div className="ebene ebene-schleier" />

        {/* z5 — Text über allem, auch über dem Schleier */}
        <div className="ebene ebene-text" style={{ pointerEvents: "none" }}>
          <p
            className={`kolumnentitel verzug-titel steigt${auf ? " auf" : ""}`}
            style={{ position: "absolute", top: "clamp(18px, 3.4vw, 34px)", left: "clamp(18px, 5vw, 64px)" }}
          >
            Oroboros Design — Akt I
          </p>
          <p
            className={`claim verzug-claim steigt${auf ? " auf" : ""}`}
            style={{ position: "absolute", left: "clamp(18px, 5vw, 64px)", bottom: "clamp(96px, 16vh, 190px)" }}
          >
            Erst sieht es dich an. Dann bewegt es sich — aber nur, wenn du dich bewegst.
          </p>
          <div
            style={{ position: "absolute", left: "clamp(18px, 5vw, 64px)", bottom: "clamp(34px, 7vh, 74px)", pointerEvents: "auto" }}
          >
            <button
              type="button"
              onClick={weiter}
              className={`weg verzug-weg steigt${auf ? " auf" : ""}`}
            >
              <span className="weg-strich" aria-hidden="true" />
              Rolle dich ein
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
