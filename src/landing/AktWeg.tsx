/**
 * AKT II — DER WEG
 *
 * Ziel: der Nutzer bewirkt etwas. Interaktion: Scroll IST die Zeitachse.
 * Rückwärts scrollen lässt das Tier zurückgehen — das ist der Beweis, dass
 * hier nichts abgespielt wird, sondern etwas gesteuert.
 *
 * DIE REIHENFOLGE IST DER KERN: erst der Abgang, dann das Produkt. Die drei
 * Karten steigen erst auf, wenn das Tier das Bild verlassen hat. Gleichzeitig
 * wären es zwei Dinge, die um denselben Blick kämpfen — und die Schlange
 * gewinnt immer.
 */
import { useEffect, useRef } from "react";
import { canvasSpannen, frameZu, naechstesBild, zeichneDeckend, type Sequenz } from "../motion/sequenz";
import { bereich, buehneBeobachten } from "../motion/buehne";
import { choreografie, FRAMES } from "./choreografie";
import { Standbild } from "./Standbild";

interface Karte {
  name: string;
  motiv: string;
  text: string;
  alt: string;
}

const KARTEN: Karte[] = [
  {
    name: "Manifest",
    motiv: "coil",
    text: "Eine Form ist nie fertig. Sie ist nur die Stelle, an der wir aufgehört haben zu schauen.",
    alt: "Die Otter halb eingerollt, von oben.",
  },
  {
    name: "Tafel",
    motiv: "hero",
    text: "Was eine Marke ausmacht, steht nicht im Text. Es steht im Blick, den sie erwidert.",
    alt: "Der Kopf der Otter, frontal.",
  },
  {
    name: "Band",
    motiv: "trav",
    text: "Der Weg über die Düne bleibt liegen, lange nachdem das Tier fort ist.",
    alt: "Die Spur der Otter quer über den Sand.",
  },
];

export function AktWeg(
  { seq, ruhig, aufFortschritt }: {
    seq: Sequenz | null;
    ruhig: boolean;
    aufFortschritt: (p: number) => void;
  },
) {
  const kasten = useRef<HTMLElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const zeile = useRef<HTMLHeadingElement>(null);
  const karten = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ruhig || !kasten.current) return;
    const c = choreografie();
    let letzterFrame = -1;

    const stop = buehneBeobachten(kasten.current, (p) => {
      aufFortschritt(p);

      if (zeile.current) {
        const aus = bereich(p, c.akt2.zeileAus[0], c.akt2.zeileAus[1]);
        zeile.current.style.transform = `translateY(${-p * c.akt2.zeileWeg}px)`;
        zeile.current.style.opacity = String(1 - aus);
      }

      // Karte i steigt in ihrem eigenen Fenster — jede um `karteVersatz` später.
      const felder = karten.current?.children;
      if (felder) {
        for (let i = 0; i < felder.length; i++) {
          const a = bereich(
            p,
            c.akt2.karteVon + i * c.akt2.karteVersatz,
            c.akt2.karteBis + i * c.akt2.karteVersatz,
          );
          const el = felder[i] as HTMLElement;
          el.style.opacity = String(a);
          el.style.transform = `translateY(${(1 - a) * c.akt2.karteWeg}px)`;
        }
      }

      const cv = leinwand.current;
      if (!cv || !seq) return;
      // Linear über den vollen Bereich — die Bühne IST die Zeitachse.
      const index = frameZu(p, FRAMES);
      const neu = canvasSpannen(cv);
      if (index === letzterFrame && !neu) return;
      letzterFrame = index;
      const bild = naechstesBild(seq, index);
      if (bild) zeichneDeckend(cv, bild);
    });
    return stop;
  }, [seq, ruhig, aufFortschritt]);

  return (
    <section className="buehne buehne-2" ref={kasten} id="akt-weg">
      <div className="bild">
        <Standbild
          name="trav"
          klasse="ebene ebene-bild"
          alt="Die Wüstenotter quert eine Düne, ihre Spur zieht sich durch den Sand."
        />
        {!ruhig && (
          <canvas
            ref={leinwand}
            className="ebene"
            role="img"
            aria-label="Die Wüstenotter quert die Düne und verlässt das Bild, gesteuert vom Scrollen."
          />
        )}
        <div className="ebene ebene-schleier" />

        <div className="ebene ebene-text" style={{ pointerEvents: "none" }}>
          <p
            className="kolumnentitel"
            style={{ position: "absolute", top: "clamp(18px, 3.4vw, 34px)", left: "clamp(18px, 5vw, 64px)" }}
          >
            Akt II — der Weg
          </p>
          <h2
            ref={zeile}
            className="zeile"
            style={{
              position: "absolute",
              top: "clamp(52px, 9vh, 108px)",
              left: "clamp(18px, 5vw, 64px)",
              right: "clamp(18px, 5vw, 64px)",
              margin: 0,
              willChange: "transform, opacity",
            }}
          >
            Rolle dich ein
          </h2>

          <div
            ref={karten}
            className="karten"
            style={{
              position: "absolute",
              left: "clamp(18px, 5vw, 64px)",
              right: "clamp(18px, 5vw, 64px)",
              bottom: "clamp(28px, 6vh, 68px)",
              pointerEvents: "auto",
            }}
          >
            {KARTEN.map((k) => (
              <article
                key={k.name}
                className="karte"
                /*
                 * Der Anfangszustand steht im MARKUP, nicht in einem
                 * JavaScript-Nachgriff: sonst blitzen bei langsamer
                 * Verbindung drei fertige Karten auf, bevor sie verschwinden.
                 */
                style={{ opacity: 0, transform: "translateY(var(--akt2-karte-weg))" }}
              >
                <img className="karte-bild" src={`/still/${k.motiv}-l.webp`} alt={k.alt} />
                <p className="karte-name">{k.name}</p>
                <p className="karte-text">{k.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
