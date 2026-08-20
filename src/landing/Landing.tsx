/**
 * Die Landing — eine Route, eine Bühne, eine Bewegung.
 *
 * Die Hornviper zieht durch die Düne, verlangsamt, rollt sich ein, schließt
 * zum Ouroboros; die Kamera fährt zurück. Im letzten Fünftel wandert der
 * Ausschnitt, bis der Ring genau dort steht, wo im Wort das erste O stünde —
 * OROBOROS, dessen erster Buchstabe die Schlange selbst ist.
 *
 * Ein durchgehender Film aus einer Aufnahme, vollständig scroll-gebunden.
 * Darüber liegen genau drei Textelemente: die Wortmarke am Anfang, der
 * Rollhinweis, das Siegel am Ende. Kein Kapiteltitel, keine Karte, kein
 * Fortschrittsring, kein Abspann.
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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  canvasSpannen, farbenLesen, frameAdresse, frameStelle, ladeNachschub, ladeVorlauf,
  naechstesBild, zeichneStelle, type Farbprobe, type Sequenz,
} from "../motion/sequenz";
import { bereich, buehneBeobachten } from "../motion/buehne";
import { ruhig as istRuhig } from "../motion/tokens";
import { choreografie, FRAMES, RING, VORLAUF_SCHRITT, satzWaehlen } from "./choreografie";
import { masse, ringAufSchirm, verwandlung, type Masse } from "./lockup";
import { Wortmarke } from "./Wortmarke";
import { Ladeschirm } from "./Ladeschirm";
import "../styles/landing.css";

export default function Landing() {
  const [ruhig] = useState<boolean>(istRuhig);
  /** Formatsatz, einmal beim Start bestimmt — siehe `choreografie.ts`. */
  const [satz] = useState(satzWaehlen);
  const [frei, setFrei] = useState(false);
  const [uebergeben, setUebergeben] = useState(false);
  const [auf, setAuf] = useState(false);
  const [schriftAuf, setSchriftAuf] = useState(false);
  const [seq, setSeq] = useState<Sequenz | null>(null);
  const [farben, setFarben] = useState<Farbprobe | null>(null);
  const [grundton, setGrundton] = useState<string | null>(null);
  /** Nur für den Bericht und den Selbsttest: ist die volle Stufe komplett? */
  const [, setScharf] = useState(false);

  const kasten = useRef<HTMLElement>(null);
  const bild = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const grund = useRef<HTMLDivElement>(null);
  const schleier = useRef<HTMLDivElement>(null);
  const marke = useRef<HTMLDivElement>(null);
  const hinweis = useRef<HTMLParagraphElement>(null);
  const lockup = useRef<HTMLDivElement>(null);
  const ringplatz = useRef<HTMLSpanElement>(null);
  const unten = useRef<HTMLDivElement>(null);

  /**
   * Was das Lockup an Geometrie braucht, EINMAL je Fenstergröße gemessen.
   *
   * Nicht je Bild: `getBoundingClientRect` auf einem Textelement erzwingt einen
   * Umbruch, und sechzigmal je Sekunde ist das genau die Art Arbeit, die eine
   * scroll-gebundene Seite ruckeln lässt. Die Zahl ändert sich nur, wenn sich
   * das Fenster ändert — oder wenn die Schrift ankommt.
   */
  const geometrie = useRef<
    { m: Masse; zielX: number; zielY: number; breite: number; hoehe: number } | null
  >(null);

  /* ————————————————————————————— Laden ————————————————————————————— */

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
    if (ruhig) { setFrei(true); setUebergeben(true); setAuf(true); return; }
    let stoppen: (() => void) | null = null;
    const s = ladeVorlauf(`${satz}-vor`, FRAMES, VORLAUF_SCHRITT, {
      beiFertig: () => {
        setSeq(s);
        setFrei(true);
        /*
         * Die Farbprobe kommt aus dem ERSTEN Frame, nicht aus einem
         * beliebigen. Der Staub der Ladeszene setzt sich zu genau diesem Bild,
         * und der Sandton am Rand des Schlussbildes ist sein Mittel. Beides aus
         * derselben Probe, damit es nicht auseinanderlaufen kann.
         */
        const erstes = s.bilder[0];
        if (erstes) setFarben(farbenLesen(erstes));
        /*
         * Der Grundton dagegen kommt aus dem LETZTEN Frame.
         *
         * Das ist kein Detail: Frame 1 ist die Eröffnung — tiefe Sonne, warmes
         * Ocker. Frame 150 ist die Aufsicht am Mittag, viel heller und blasser.
         * Füllte man den Rand des Schlussbildes mit dem Mittel des ersten
         * Frames, säße ein sattes Ocker neben blassem Sand, und die Kante wäre
         * das Erste, was man sieht.
         */
        const letztes = s.bilder[FRAMES - 1];
        if (letztes) setGrundton(farbenLesen(letztes, 16)?.rand ?? null);
        stoppen = ladeNachschub(satz, s, {
          beiErsatz: (fertig, von) => { if (fertig >= von) setScharf(true); },
        });
      },
    });
    return () => stoppen?.();
  }, [satz, ruhig]);

  /** Der Auftritt der Wortmarke zündet erst, wenn die Ladeszene übergeben hat. */
  useEffect(() => {
    if (!uebergeben || auf) return;
    const id = requestAnimationFrame(() => setAuf(true));
    return () => cancelAnimationFrame(id);
  }, [uebergeben, auf]);

  /*
   * Solange die Ladeszene läuft, ist die Seite festgehalten.
   *
   * Nicht bloß optisch: ohne diese Sperre kann jemand während des Ladens
   * durchscrollen und landet auf einer Bühne, deren Canvas noch leer ist.
   * „Nichts ist scrollbar, bevor alle Frames geladen sind" ist eine Zusage
   * über das Verhalten, nicht über die Deckkraft eines Deckels. Sie hält bis
   * zur ÜBERGABE, nicht bis zur Freigabe: der Staub braucht seine Sekunden,
   * und mitten hineinzuscrollen hieße, ihn abzuschneiden.
   */
  useEffect(() => {
    if (uebergeben) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => { document.body.style.overflow = vorher; };
  }, [uebergeben]);

  /* ————————————————————————— Die Geometrie des Lockups ————————————————————————— */

  /*
   * Zwei Durchgänge, und beide sind nötig.
   *
   * Erst wird die Ringgröße gesetzt — sie hängt davon ab, wie weit der Film
   * reicht, und der Umbruch kann sie nicht kennen. Dann, ein Bild später,
   * wird der Kasten GEMESSEN, den der Umbruch daraufhin freigelassen hat.
   * Die Reihenfolge lässt sich nicht umdrehen: die Breite von „ROBOROS"
   * entscheidet, wo die Mitte der Zeile liegt, und die hängt an der Größe des
   * Rings.
   */
  const vermessen = useCallback(() => {
    const kastenEl = bild.current, platz = ringplatz.current, zeile = lockup.current;
    if (!kastenEl || !platz || !zeile) return;
    const r = RING[satz];
    const k = kastenEl.getBoundingClientRect();
    const m = masse(r, k.width, k.height);
    zeile.style.setProperty("--ring-mass", `${m.ring}px`);
    zeile.style.setProperty("--lockup-schrift", `${m.schrift}px`);
    /*
     * SENKRECHT WIRD NICHT GESCHWENKT.
     *
     * Waagerecht muss das Bild wandern: der Ring sitzt in der Bildmitte, im
     * Wort steht er links. Senkrecht müsste er nicht — und täte er es doch,
     * stünde der geschrumpfte Film als Rechteck in einer Ecke, mit Sandbändern
     * rechts UND unten. Gemessen auf 1440 × 900 sah genau das aus wie ein
     * Fehler im Umbruch.
     *
     * Also andersherum: das Bild bleibt senkrecht mittig, und die Zeile rückt
     * dorthin, wo der Ring danach steht. Die Bänder liegen dann oben und unten
     * gleich hoch, und die einzige Kante läuft senkrecht durch — das liest
     * sich als Satz, nicht als Panne.
     */
    const natur = ringAufSchirm(r, k.width, k.height);
    const ringY = k.height / 2 + (natur.y - k.height / 2) * m.maßstab;
    /*
     * ERST ZURÜCKSETZEN, DANN MESSEN.
     *
     * `vermessen` läuft mehrmals — beim Aufbau, wenn die Schrift ankommt, bei
     * jeder Größenänderung. Misst man die Zeile, während die Verschiebung des
     * vorigen Durchgangs noch anliegt, steckt sie im Messwert und wird ein
     * zweites Mal aufgerechnet. Gemessen auf 390 × 844: der Ring saß 121 px
     * unter seinem Buchstaben.
     */
    const spalte = zeile.parentElement as HTMLElement | null;
    if (spalte) spalte.style.transform = "";
    requestAnimationFrame(() => {
      const p = platz.getBoundingClientRect();
      const k2 = kastenEl.getBoundingClientRect();
      if (spalte) {
        const jetzt = p.top + p.height / 2 - k2.top;
        spalte.style.transform = `translateY(${ringY - jetzt}px)`;
      }
      geometrie.current = {
        m,
        zielX: p.left + p.width / 2 - k2.left,
        zielY: ringY,
        breite: k2.width,
        hoehe: k2.height,
      };
    });
  }, [satz]);

  useEffect(() => {
    if (ruhig) return;
    vermessen();
    window.addEventListener("resize", vermessen);
    /* Die Zeilenbreite hängt an der Schrift. Kommt Jost erst nach dem ersten
       Umbruch an, verschiebt sich die Mitte — und der Ring säße daneben. */
    document.fonts?.ready.then(vermessen).catch(() => {});
    return () => window.removeEventListener("resize", vermessen);
  }, [ruhig, vermessen]);

  /* ————————————————————————————— Die Bewegung ————————————————————————————— */

  useEffect(() => {
    if (ruhig || !kasten.current) return;
    const c = choreografie();
    const r = RING[satz];
    let letzterFrame = -1;

    return buehneBeobachten(kasten.current, (p) => {
      /*
       * Der Rollhinweis geht nach der ersten Geste.
       *
       * Solange NICHTS gerollt wurde, wird die Deckkraft nicht gesetzt,
       * sondern zurückgegeben: dann gehört sie dem Stylesheet, und dort steht
       * ihr Auftritt mit seinem Verzug. Setzte die Schleife hier schon bei
       * p = 0 eine 1, stünde der Hinweis sofort da — und weil der Grund der
       * Ladeszene beim vierten Schlag durchsichtig wird, sah man ihn dort
       * mitten im Staub stehen.
       */
      if (hinweis.current) {
        const h = bereich(p, c.hinweis[0], c.hinweis[1]);
        if (h > 0) hinweis.current.style.opacity = String(1 - h);
        else hinweis.current.style.removeProperty("opacity");
      }

      // Die Wortmarke zieht nach oben weg und ist früh fort.
      if (marke.current) {
        marke.current.style.opacity = String(1 - bereich(p, c.marke[0], c.marke[1]));
        marke.current.style.transform = `translateY(${-p * c.markeWeg}px)`;
      }

      /*
       * Das letzte Fünftel: der Ausschnitt wandert, bis der Ring das O ist.
       *
       * `a` ist 0, solange der Film läuft — dann steht hier keine Verwandlung
       * und der Canvas trägt gar keinen `transform`. Eine Verwandlung mit
       * Maßstab 1 und Versatz 0 wäre nicht dasselbe: sie legte über die ganze
       * Seite eine eigene Ebene im Compositor.
       */
      const a = bereich(p, c.lockup[0], c.lockup[1]);
      const cv = leinwand.current;
      const g = geometrie.current;
      if (cv && g) {
        if (a <= 0) {
          if (cv.style.transform) cv.style.transform = "";
        } else {
          const v = verwandlung(r, g.breite, g.hoehe, g.m, g.zielX, g.zielY, a);
          cv.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.maßstab})`;
        }
      }
      if (grund.current) grund.current.style.opacity = a > 0 ? "1" : "0";

      /*
       * Der Schleier weicht zum Schluss.
       *
       * Seine untere Kante ist zu 88 % schwarz. Bliebe er stehen, wäre das
       * Schlussbild wieder abgedunkelt — nur eben von unten statt flächig.
       * Genau das sollte in dieser Phase verschwinden.
       */
      if (schleier.current) schleier.current.style.opacity = String(1 - a);

      // Die sieben Buchstaben treten im letzten Zehntel einzeln dazu.
      const zeigen = p >= c.schrift[0];
      setSchriftAuf((v) => (v === zeigen ? v : zeigen));

      if (unten.current) {
        const s = bereich(p, c.siegel[0], c.siegel[1]);
        unten.current.style.opacity = String(s);
        unten.current.style.transform =
          `scale(${c.siegelSkala + (1 - c.siegelSkala) * s})`;
      }

      /*
       * Der Film.
       *
       * Neu gezeichnet wird, wenn sich die STELLE zwischen zwei Frames
       * merklich ändert — nicht erst beim Framewechsel. Sonst bliebe die
       * Überblendung wirkungslos: sie lebt genau von dem Bruchteil, den ein
       * ganzzahliger Index wegwirft.
       */
      if (!cv || !seq) return;
      const anteil = bereich(p, c.film[0], c.film[1]);
      const stelle = frameStelle(anteil, FRAMES);
      const jetzt = stelle.i + Math.round(stelle.t * 10) / 10;
      const neu = canvasSpannen(cv, naechstesBild(seq, stelle.i));
      if (jetzt === letzterFrame && !neu) return;
      letzterFrame = jetzt;
      zeichneStelle(cv, seq, anteil, true);
    });
  }, [seq, ruhig, satz]);

  /*
   * Der erste Frame muss stehen, BEVOR die Ladeszene ihn aufdeckt.
   *
   * Die Bühnenschleife oben zeichnet erst, wenn gescrollt oder die Größe
   * geändert wird — und während der Ladeszene passiert beides nicht. Ohne
   * diesen einen Aufruf setzte sich der Staub vor eine leere Fläche.
   */
  useEffect(() => {
    const cv = leinwand.current;
    if (ruhig || !cv || !seq) return;
    canvasSpannen(cv, naechstesBild(seq, 0));
    zeichneStelle(cv, seq, 0, false);
  }, [seq, ruhig]);

  /* ————————————————————————————— Das Markup ————————————————————————————— */

  const uebergabe = useCallback(() => setUebergeben(true), []);

  return (
    <div className="landing-seite">
      {!uebergeben && (
        <Ladeschirm bereit={frei} farben={farben} ruhig={ruhig} beiUebergabe={uebergabe} />
      )}

      <section className="buehne" ref={kasten}>
        <div className="bild" ref={bild}>
          {/*
            Der Grund, auf dem das Schlussbild steht. Seine Farbe wird aus dem
            letzten Frame gelesen, nicht geschrieben — siehe `farbenLesen`.
            Ohne Probe bleibt er dunkel; dann ist der Rand des Schlussbildes
            eben dunkel statt sandfarben, und nichts bricht.
          */}
          <div
            ref={grund}
            className="ebene ebene-grund"
            style={grundton ? { background: grundton } : undefined}
          />

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
              /*
               * Die gemessenen Ringmaße, damit ein Messgerät prüfen kann, ob
               * der Ring am Ende wirklich im Buchstaben steht — ohne dieselben
               * drei Zahlen ein zweites Mal zu pflegen. Ein Prüfstand, der
               * seine Sollwerte aus der Quelle abschreibt, prüft nichts.
               */
              data-ring={`${RING[satz].cx},${RING[satz].cy},${RING[satz].d}`}
              role="img"
              aria-label="Eine Hornviper zieht durch die Düne, rollt sich ein und schließt sich zum Ouroboros. Die Bewegung folgt dem Scrollen."
            />
          )}

          <div ref={schleier} className="ebene ebene-schleier" />

          <div className="ebene ebene-text">
            <div className="ebene" ref={marke}>
              <Wortmarke text="OROBOROS" auf={auf} />
            </div>

            <p ref={hinweis} className={`hinweis${auf ? " auf" : ""}`}>Scrollen</p>

            <div className="siegel">
              {/*
                Das Lockup. Der leere Kasten links IST das erste O — gefüllt
                wird er vom Film, indem sich der Ausschnitt dorthin verschiebt.
                Deshalb steht er hier ohne Inhalt und ohne Rahmen.
              */}
              <div className="lockup" ref={lockup}>
                {ruhig ? (
                  /*
                   * Ohne Bewegung gibt es keine Verwandlung — und ohne
                   * Verwandlung stünde neben dem Wort ein leerer Kasten, wo
                   * das O sein sollte. Dann lieber das ganze Wort.
                   */
                  <Wortmarke text="OROBOROS" auf klasse="lockup-wort" />
                ) : (
                  <>
                    <span className="lockup-ring" ref={ringplatz} aria-hidden="true" />
                    <Wortmarke
                      text="ROBOROS"
                      auf={schriftAuf}
                      klasse="lockup-wort"
                      beschriftung="OROBOROS"
                    />
                  </>
                )}
              </div>

              <div ref={unten} className="siegel-unten" style={{ opacity: 0 }}>
                <p className="siegel-unter">Design</p>
                <span className="siegel-strich" aria-hidden="true" />
                <p className="siegel-satz">Die nächste Form ist nie die letzte.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
