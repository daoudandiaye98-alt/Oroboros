/**
 * Die Landing — eine Route, eine Bühne, eine Bewegung.
 *
 * Die Hornviper zieht durch die Düne, verlangsamt, rollt sich ein, schließt
 * zum Ouroboros; die Kamera fährt auf Aufsicht. Ein durchgehender Film aus
 * EINER Aufnahme, vollständig scroll-gebunden.
 *
 * Darüber liegen genau drei Textelemente: die Wortmarke am Anfang, der
 * Rollhinweis, das Siegel am Ende. Kein Kapiteltitel, keine Karte, kein
 * Fortschrittsring, kein Abspann — die frühere Fassung hatte all das, und
 * genau deshalb las sie sich wie drei Seiten statt wie eine Bewegung.
 *
 * WARUM KEIN `<video>`. Ein Video-Element ist für Wiedergabe gebaut, nicht
 * für Aufsuchen. `currentTime` zu setzen heißt: zum nächsten Keyframe
 * springen, dorthin dekodieren, ausgeben — je Bild, in beide Richtungen. Eine
 * Bildsequenz hat keinen Dekoderzustand: Frame 41 kostet so viel wie Frame 3,
 * vorwärts wie rückwärts.
 *
 * WARUM KEINE SCROLL-BIBLIOTHEK. `getBoundingClientRect` in der gemeinsamen
 * Bildschleife aus Phase 0 fragt jedes Bild neu und kann per Bauart nicht
 * veralten. Eine vorausberechnete Strecke müsste bei jedem Resize und jeder
 * Adressleiste des Telefons neu vermessen werden.
 */
import { useEffect, useRef, useState } from "react";
import {
  canvasSpannen, frameAdresse, frameStelle, ladeNachschub, ladeVorlauf,
  naechstesBild, zeichneStelle, type Sequenz,
} from "../motion/sequenz";
import { bereich, buehneBeobachten } from "../motion/buehne";
import { ruhig as istRuhig } from "../motion/tokens";
import { choreografie, FRAMES, VORLAUF_SCHRITT, satzWaehlen } from "./choreografie";
import { Wortmarke } from "./Wortmarke";
import { Ladeschirm } from "./Ladeschirm";
import "../styles/landing.css";

export default function Landing() {
  const [ruhig] = useState<boolean>(istRuhig);
  /** Formatsatz, einmal beim Start bestimmt — siehe `choreografie.ts`. */
  const [satz] = useState(satzWaehlen);
  const [anteil, setAnteil] = useState(0);
  const [frei, setFrei] = useState(false);
  const [auf, setAuf] = useState(false);
  const [seq, setSeq] = useState<Sequenz | null>(null);
  /** Nur für den Bericht und den Selbsttest: ist die volle Stufe komplett? */
  const [, setScharf] = useState(false);

  const kasten = useRef<HTMLElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const marke = useRef<HTMLDivElement>(null);
  const hinweis = useRef<HTMLParagraphElement>(null);
  const dunkel = useRef<HTMLDivElement>(null);
  const siegel = useRef<HTMLDivElement>(null);

  /* ————————————————————————— Laden ————————————————————————— */

  /*
   * ZWEI STUFEN.
   *
   * Zuerst der Vorlauf: jeder vierte Frame, klein und grob. Sobald er da ist,
   * wird freigegeben — das Array ist dann vollständig, weil die Lücken mit
   * der jeweils letzten Stütze gefüllt sind. Es gibt also keinen leeren
   * Platz, an dem die Bewegung stocken könnte.
   *
   * Danach strömt die volle Auflösung nach und ersetzt die Frames einzeln,
   * während gescrollt wird. Vorher hing Freigabezeit und Bildschärfe an
   * derselben Zahl: um unter vier Sekunden freizugeben, musste die Güte auf
   * 45 und die Breite auf 420 px — und damit war das Bild dauerhaft unscharf.
   */
  useEffect(() => {
    // Im Ruhemodus gibt es keine Sequenz. Ein Ladeschirm für ein Standbild
    // wäre eine Wartezeit ohne Gegenwert.
    if (ruhig) { setFrei(true); setAuf(true); return; }
    let stoppen: (() => void) | null = null;
    const s = ladeVorlauf(`${satz}-vor`, FRAMES, VORLAUF_SCHRITT, {
      beiFortschritt: setAnteil,
      beiFertig: () => {
        setSeq(s);
        setFrei(true);
        stoppen = ladeNachschub(satz, s, {
          beiErsatz: (fertig, von) => { if (fertig >= von) setScharf(true); },
        });
      },
    });
    return () => stoppen?.();
  }, [ruhig, satz]);

  /** Der Auftritt der Wortmarke zündet erst, wenn der Ladeschirm weg ist. */
  useEffect(() => {
    if (!frei || auf) return;
    const id = requestAnimationFrame(() => setAuf(true));
    return () => cancelAnimationFrame(id);
  }, [frei, auf]);

  /*
   * Solange geladen wird, ist die Seite festgehalten.
   *
   * Nicht bloß optisch: ohne diese Sperre kann jemand während des Ladens
   * durchscrollen und landet auf einer Bühne, deren Canvas noch leer ist.
   * „Nichts ist scrollbar, bevor alle Frames geladen sind" ist eine Zusage
   * über das Verhalten, nicht über die Deckkraft eines Deckels.
   */
  useEffect(() => {
    if (frei) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => { document.body.style.overflow = vorher; };
  }, [frei]);

  /* ————————————————————————— Die Bewegung ————————————————————————— */

  useEffect(() => {
    if (ruhig || !kasten.current) return;
    const c = choreografie();
    let letzterFrame = -1;

    return buehneBeobachten(kasten.current, (p) => {
      // Der Rollhinweis geht nach der ersten Geste.
      if (hinweis.current) {
        hinweis.current.style.opacity =
          String(1 - bereich(p, c.hinweis[0], c.hinweis[1]));
      }

      // Die Wortmarke zieht nach oben weg und ist früh fort.
      if (marke.current) {
        marke.current.style.opacity = String(1 - bereich(p, c.marke[0], c.marke[1]));
        marke.current.style.transform = `translateY(${-p * c.markeWeg}px)`;
      }

      if (dunkel.current) {
        dunkel.current.style.opacity = String(bereich(p, c.dunkel[0], c.dunkel[1]));
      }

      if (siegel.current) {
        const a = bereich(p, c.siegel[0], c.siegel[1]);
        siegel.current.style.opacity = String(a);
        siegel.current.style.transform =
          `scale(${c.siegelSkala + (1 - c.siegelSkala) * a})`;
      }

      /*
       * Der Film.
       *
       * Neu gezeichnet wird, wenn sich die STELLE zwischen zwei Frames
       * merklich ändert — nicht erst beim Framewechsel. Sonst bliebe die
       * Überblendung wirkungslos: sie lebt genau von dem Bruchteil, den ein
       * ganzzahliger Index wegwirft.
       */
      const cv = leinwand.current;
      if (!cv || !seq) return;
      const anteil = bereich(p, c.film[0], c.film[1]);
      const stelle = frameStelle(anteil, FRAMES);
      const jetzt = stelle.i + Math.round(stelle.t * 10) / 10;
      const neu = canvasSpannen(cv, naechstesBild(seq, stelle.i));
      if (jetzt === letzterFrame && !neu) return;
      letzterFrame = jetzt;
      zeichneStelle(cv, seq, anteil, true);
    });
  }, [seq, ruhig]);

  /* ————————————————————————— Das Markup ————————————————————————— */

  return (
    <div className="landing-seite">
      {!ruhig && <Ladeschirm anteil={anteil} fertig={frei} />}

      <section className="buehne" ref={kasten}>
        <div className="bild">
          {ruhig ? (
            /*
             * Ruhemodus: der LETZTE Frame als Standbild — das Ergebnis der
             * Bewegung, nicht ihr Anfang. Wer die Bewegung nicht sehen will
             * oder kann, soll trotzdem sehen, worauf sie hinausläuft.
             */
            <img
              className="ebene ebene-bild"
              src={frameAdresse(satz, FRAMES - 1)}
              alt="Eine Hornviper hat sich im Sand zum geschlossenen Ring eingerollt — der Ouroboros, von oben gesehen."
            />
          ) : (
            <canvas
              ref={leinwand}
              className="ebene ebene-bild"
              /*
               * Die Adresse eines Frames der VOLLEN Stufe, damit ein
               * Messgerät die tatsächliche Quellauflösung erfragen kann,
               * ohne sie aus einem Bauskript abzuschreiben. Kostet nichts —
               * es ist ein Attribut, kein Ladevorgang.
               */
              data-probe={frameAdresse(satz, 0)}
              role="img"
              aria-label="Eine Hornviper zieht durch die Düne, rollt sich ein und schließt sich zum Ouroboros. Die Bewegung folgt dem Scrollen."
            />
          )}

          <div className="ebene ebene-schleier" />
          <div ref={dunkel} className="ebene dunkel" style={{ opacity: 0 }} />

          <div className="ebene ebene-text">
            <div className="ebene" ref={marke}>
              <Wortmarke text="OROBOROS" auf={auf} />
            </div>

            <p ref={hinweis} className={`hinweis${auf ? " auf" : ""}`}>Scrollen</p>

            <div ref={siegel} className="siegel" style={{ opacity: 0 }}>
              <p className="siegel-marke">OROBOROS</p>
              <p className="siegel-unter">Design</p>
              <span className="siegel-strich" aria-hidden="true" />
              <p className="siegel-satz">Die nächste Form ist nie die letzte.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
