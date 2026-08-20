/**
 * Die Landing — eine Route, eine Bühne, eine Bewegung.
 *
 * Die Hornviper zieht durch die Düne, verlangsamt, rollt sich ein, schließt
 * zum Ouroboros; dann fährt die Kamera zurück, bis der Ring so groß steht, wie
 * ihn das erste O des Wortes braucht — OROBOROS, dessen erster Buchstabe die
 * Schlange selbst ist.
 *
 * DIE GRÖSSE KOMMT AUS DER WAHL DES FRAMES, NICHT AUS EINER TRANSFORMATION.
 * Das ist der Kern des Kontinuitäts-Auftrags. Ein geschrumpftes Bild ist
 * kleiner als sein Fenster und hat einen Rand; dieser Rand war die sichtbare
 * Kante. Bewegt wird jetzt nur noch innerhalb der Overscan-Reserve — also
 * innerhalb dessen, was `cover` ohnehin abschneidet. Die Rechnung dazu steht
 * in `kamera.ts`, die Vermessung des Materials in `scripts/ring-messen.mjs`.
 *
 * WARUM KEIN `<video>`. Ein Video-Element ist für Wiedergabe gebaut, nicht
 * für Aufsuchen. `currentTime` zu setzen heißt: zum nächsten Keyframe
 * springen, dorthin dekodieren, ausgeben — je Bild, in beide Richtungen. Eine
 * Bildsequenz hat keinen Dekoderzustand: Frame 41 kostet so viel wie Frame 3.
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
import { choreografie, VORLAUF_SCHRITT, satzWaehlen } from "./choreografie";
import { aufbauRechnen, type Aufbau, type Ringdaten } from "./kamera";
import { Wortmarke } from "./Wortmarke";
import { Ladeschirm } from "./Ladeschirm";
import "../styles/landing.css";

/** Bei welcher Schriftgröße die Wortbreite gemessen wird. */
const MESS_SCHRIFT = 100;

export default function Landing() {
  const [ruhig] = useState<boolean>(istRuhig);
  /** Formatsatz, einmal beim Start bestimmt — siehe `choreografie.ts`. */
  const [satz] = useState(satzWaehlen);
  const [ringdaten, setRingdaten] = useState<Ringdaten | null>(null);
  const [aufbau, setAufbau] = useState<Aufbau | null>(null);
  const [uebergeben, setUebergeben] = useState(false);
  const [auf, setAuf] = useState(false);
  const [schriftAuf, setSchriftAuf] = useState(false);
  const [seq, setSeq] = useState<Sequenz | null>(null);
  const [farben, setFarben] = useState<Farbprobe | null>(null);
  const [erstes, setErstes] = useState<HTMLImageElement | null>(null);
  const [frei, setFrei] = useState(false);
  /** Nur für den Bericht und den Selbsttest: ist die volle Stufe komplett? */
  const [, setScharf] = useState(false);

  const kasten = useRef<HTMLElement>(null);
  const bild = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const staub = useRef<HTMLCanvasElement>(null);
  const schleier = useRef<HTMLDivElement>(null);
  const marke = useRef<HTMLDivElement>(null);
  const hinweis = useRef<HTMLParagraphElement>(null);
  const lockup = useRef<HTMLDivElement>(null);
  const wort = useRef<HTMLDivElement>(null);
  const sicher = useRef<HTMLDivElement>(null);
  const unten = useRef<HTMLDivElement>(null);

  /** Der Aufbau auch als Referenz — die Bildschleife darf nicht neu binden. */
  const aufbauRef = useRef<Aufbau | null>(null);
  /** Wie viele Frames tatsächlich geladen wurden. Ein Resize ändert das nicht. */
  const geladen = useRef(0);

  /* ————————————————————————— Die Ringdaten ————————————————————————— */

  /*
   * `ring.json` kommt VOR den Frames, und das ist keine Reihenfolge aus
   * Bequemlichkeit: erst mit ihr steht fest, WIE VIELE Frames dieses Fenster
   * überhaupt braucht. Auf 1440 × 900 sind es 141 von 152, auf 390 × 844 161
   * von 166 — der Rest wird nie angefordert.
   *
   * Die Datei ist wenige Kilobyte groß und lädt, während sich der Ouroboros
   * zeichnet. Sie kostet also keine wahrnehmbare Zeit.
   */
  useEffect(() => {
    if (ruhig) return;
    let lebt = true;
    fetch(`/seq/${satz}/ring.json`)
      .then((a) => a.json())
      .then((d: Ringdaten) => { if (lebt) setRingdaten(d); })
      .catch(() => { if (lebt) setRingdaten(null); });
    return () => { lebt = false; };
  }, [satz, ruhig]);

  /* ————————————————————————— Der Aufbau ————————————————————————— */

  /*
   * Zwei Durchgänge, und beide sind nötig.
   *
   * Zuerst wird die Wortbreite gemessen — bei einer festen Schriftgröße, aus
   * der geladenen Schrift, in em umgerechnet. Sie zu raten hieße, bei jedem
   * Schriftwechsel eine falsche Zeilenbreite zu haben und das erst in der
   * Aufnahme zu sehen. Dann rechnet `kamera.ts` daraus den Frame, den Schwenk
   * und die Maße, und erst dann bekommt die Zeile ihre echte Größe.
   */
  const vermessen = useCallback(() => {
    const kastenEl = bild.current, zeile = lockup.current, w = wort.current;
    if (!ringdaten || !kastenEl || !zeile || !w) return;
    const k = kastenEl.getBoundingClientRect();

    zeile.style.setProperty("--lockup-schrift", `${MESS_SCHRIFT}px`);
    const wortEm = w.getBoundingClientRect().width / MESS_SCHRIFT;

    // Der sichere Rand: Gestaltungsmaß plus das, was das Gerät sich nimmt.
    const st = sicher.current ? getComputedStyle(sicher.current) : null;
    const einzug = st ? Math.max(parseFloat(st.paddingLeft) || 0, parseFloat(st.paddingRight) || 0) : 0;
    const rand = Math.max(16, Math.min(72, k.width * 0.05)) + einzug;

    const a = aufbauRechnen(ringdaten, k.width, k.height, rand, wortEm);
    if (!a) {
      // Kein Frame trägt dieses Fenster. Nicht kaschieren: melden, und die
      // Zeile bleibt fort. Dann fehlt Bildmaterial, und das ist keine
      // Codefrage — siehe Bericht.
      console.error("Oroboros: kein Frame passt in dieses Fenster", k.width, k.height);
      setAufbau(null);
      aufbauRef.current = null;
      return;
    }

    zeile.style.setProperty("--ring-mass", `${a.ringPx}px`);
    zeile.style.setProperty("--lockup-schrift", `${a.schriftPx}px`);
    zeile.style.left = `${a.ringX - a.ringPx / 2}px`;
    zeile.style.top = `${a.ringY}px`;

    /*
     * DAS SIEGEL WEICHT DEM RING AUS.
     *
     * Es hing an der Fensterunterkante, der Ring hängt an der Bildmitte — zwei
     * Anker, die nichts voneinander wissen. Auf 844 × 390 lief „DESIGN"
     * dadurch mitten durch den Ring. Kein Messwert hat das gemeldet; der
     * Kontrast stimmte, die Ränder stimmten, die Zeile stand im Bild.
     *
     * Jetzt bekommt das Siegel seinen Platz unter dem Ring zugewiesen, sofern
     * er dort hinpasst. Passt er nicht, bleibt der Anker aus dem Stylesheet —
     * dann ist unten mehr Platz als neben dem Ring.
     */
    const u = unten.current;
    if (u) {
      for (const eig of ["top", "bottom", "left", "right", "maxWidth", "alignItems", "textAlign"]) {
        u.style.removeProperty(eig.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));
      }
      const kasten2 = u.getBoundingClientRect();
      const drunter = a.ringY + a.ringPx / 2 + Math.max(18, k.width * 0.03);
      // Der senkrechte Rand kommt aus der HÖHE, nicht aus der Breite. `rand`
      // oben ist ein Seitenmaß — auf 844 × 390 sind das 42 px und damit fast
      // ein Achtel der Fensterhöhe.
      const untenRand = Math.max(12, k.height * 0.04);
      const linksVomWort = a.ringX - a.ringPx / 2;

      if (drunter + kasten2.height <= k.height - untenRand) {
        // Der Normalfall: unter den Ring, mittig.
        u.style.top = `${drunter}px`;
        u.style.bottom = "auto";
      } else if (linksVomWort - 2 * rand > 190) {
        /*
         * Flaches Fenster: unter den Ring passt es nicht.
         *
         * Auf 844 × 390 lief „DESIGN" mitten durch den Ring, weil das Siegel
         * an der Fensterunterkante hing und der Ring an der Bildmitte — zwei
         * Anker, die nichts voneinander wissen. Unter den Ring geschoben passt
         * es dort auch nicht: der Satz bricht auf zwei Zeilen, und die
         * Fensterhöhe ist 390.
         *
         * Links vom Lockup ist der Platz aber frei — das Wort steht rechts der
         * Bildmitte. Dorthin, linksbündig, auf der Höhe des Rings.
         */
        u.style.left = `${rand}px`;
        u.style.right = "auto";
        u.style.top = `${a.ringY}px`;
        u.style.bottom = "auto";
        u.style.maxWidth = `${linksVomWort - 2 * rand}px`;
        u.style.alignItems = "flex-start";
        u.style.textAlign = "left";
      }
    }

    aufbauRef.current = a;
    setAufbau(a);
    if (geladen.current === 0) geladen.current = a.frames;

  }, [ringdaten]);

  useEffect(() => {
    if (ruhig) return;
    vermessen();
    /*
     * `resize` UND `orientationchange`. Auf iOS meldet `resize` beim Drehen
     * gelegentlich noch die alten Maße; das zweite Ereignis kommt danach und
     * rechnet mit den richtigen. Die Rollposition bleibt dabei stehen, weil
     * hier nichts gescrollt wird — die Bühnenhöhe in `svh` ändert sich beim
     * Ein- und Ausfahren der Adressleiste nicht.
     */
    window.addEventListener("resize", vermessen);
    window.addEventListener("orientationchange", vermessen);
    document.fonts?.ready.then(vermessen).catch(() => {});
    return () => {
      window.removeEventListener("resize", vermessen);
      window.removeEventListener("orientationchange", vermessen);
    };
  }, [ruhig, vermessen]);

  /* ————————————————————————————— Laden ————————————————————————————— */

  /*
   * ZWEI STUFEN.
   *
   * Zuerst der Vorlauf: jeder vierte Frame, klein und grob. Sobald er da ist,
   * wird freigegeben — das Array ist dann vollständig, weil die Lücken mit der
   * jeweils letzten Stütze gefüllt sind. Danach strömt die volle Auflösung
   * nach und ersetzt die Frames einzeln, während gescrollt wird.
   *
   * Geladen wird nur bis zum Frame, an dem die Bühne endet. Alles danach im
   * Film wird nicht verwendet und deshalb auch nicht angefordert.
   */
  const gestartet = useRef(false);
  useEffect(() => {
    if (ruhig) { setFrei(true); setUebergeben(true); setAuf(true); return; }
    if (!aufbau || gestartet.current) return;
    gestartet.current = true;
    const s = ladeVorlauf(`${satz}-vor`, aufbau.frames, VORLAUF_SCHRITT, {
      beiFertig: () => {
        setSeq(s);
        setFrei(true);
        // Die Farbprobe kommt aus dem ERSTEN Frame: der Staub der Ladeszene
        // setzt sich zu genau diesem Bild.
        const erstesBild = s.bilder[0];
        if (erstesBild) { setFarben(farbenLesen(erstesBild)); setErstes(erstesBild); }
      },
    });
  }, [satz, ruhig, aufbau]);

  /*
   * DER NACHSCHUB BEKOMMT EINEN EIGENEN EFFEKT, und das ist kein Aufräumen.
   *
   * Er stand vorher im Effekt oben, gestartet aus `beiFertig`. Dessen
   * Abhängigkeiten enthielten `seq` — und genau dieses `seq` setzt `beiFertig`.
   * Also lief der Effekt neu, sein Aufräumen rief `stoppen()`, und der
   * Nachschub endete nach sechs von 141 Frames. Sichtbar war das nicht als
   * Fehler, sondern als matschiges Schlussbild: der Vorlauf ist 480 px breit,
   * das Fenster 1440 — dreifach hochgerechnet.
   *
   * Hier hängt er nur an `seq`, und `seq` wird genau einmal gesetzt.
   */
  useEffect(() => {
    if (ruhig || !seq) return;
    return ladeNachschub(satz, seq, {
      beiErsatz: (fertig, von) => { if (fertig >= von) setScharf(true); },
    });
  }, [seq, satz, ruhig]);

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
   */
  useEffect(() => {
    if (uebergeben) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => { document.body.style.overflow = vorher; };
  }, [uebergeben]);

  /* ————————————————————————————— Die Bewegung ————————————————————————————— */

  useEffect(() => {
    if (ruhig || !kasten.current) return;
    const c = choreografie();
    let letzterFrame = -1;
    let letzterSchwenk = Number.NaN;

    return buehneBeobachten(kasten.current, (p) => {
      /*
       * Der Rollhinweis geht nach der ersten Geste. Solange nichts gerollt
       * wurde, wird die Deckkraft nicht gesetzt, sondern zurückgegeben — dann
       * gehört sie dem Stylesheet, und dort steht ihr Auftritt mit Verzug.
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
       * Der Schleier weicht zum Schluss.
       *
       * Seine untere Kante ist zu 88 % schwarz. Bliebe er stehen, wäre das
       * Schlussbild wieder abgedunkelt — nur eben von unten statt flächig.
       */
      const a = bereich(p, c.lockup[0], c.lockup[1]);
      if (schleier.current) schleier.current.style.opacity = String(1 - a);

      // Die sieben Buchstaben treten im letzten Zehntel einzeln dazu.
      const zeigen = p >= c.schrift[0];
      setSchriftAuf((v) => (v === zeigen ? v : zeigen));

      if (unten.current) {
        const s = bereich(p, c.siegel[0], c.siegel[1]);
        unten.current.style.opacity = String(s);
        // `translateY(-50%)` nur, wenn die Zeile senkrecht am Ring hängt.
        const mittig = unten.current.style.alignItems === "flex-start";
        unten.current.style.transform =
          `translateY(calc(${(1 - s) * c.siegelWeg}px${mittig ? " - 50%" : ""}))`;
      }

      const cv = leinwand.current;
      const auf2 = aufbauRef.current;
      if (!cv || !seq || !auf2) return;

      /*
       * Der Film — und der Schwenk.
       *
       * Der Schwenk läuft über dasselbe Fenster wie das Lockup und ist die
       * EINZIGE Bewegung, die das Bild erfährt. Er bleibt per Bauart innerhalb
       * der Overscan-Reserve; siehe `kamera.ts`.
       */
      const schwenk = auf2.schwenk * a;
      const anteil = bereich(p, c.film[0], c.film[1]);
      const anzahl = Math.min(auf2.frames, geladen.current || auf2.frames);
      const stelle = frameStelle(anteil, anzahl);
      const jetzt = stelle.i + Math.round(stelle.t * 10) / 10;
      const neu = canvasSpannen(cv, naechstesBild(seq, stelle.i));
      if (jetzt === letzterFrame && schwenk === letzterSchwenk && !neu) return;
      letzterFrame = jetzt;
      letzterSchwenk = schwenk;
      zeichneStelle(cv, seq, anteil, true, schwenk, anzahl);
    });
  }, [seq, ruhig]);

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
    zeichneStelle(cv, seq, 0, false, 0, seq.anzahl);
  }, [seq, ruhig]);

  /* ————————————————————————————— Das Markup ————————————————————————————— */

  const uebergabe = useCallback(() => setUebergeben(true), []);

  return (
    <div className="landing-seite">
      {!uebergeben && (
        <Ladeschirm
          bereit={frei} farben={farben} erstes={erstes} staub={staub}
          ruhig={ruhig} beiUebergabe={uebergabe}
        />
      )}

      <section className="buehne" ref={kasten}>
        <div className="bild" ref={bild}>
          {/* Misst, was das Gerät sich an den Rändern nimmt. Unsichtbar. */}
          <div ref={sicher} className="sicherer-rand" aria-hidden="true" />

          {ruhig ? (
            /*
             * Ruhemodus: der letzte Frame des Hauptfilms als Standbild — der
             * geschlossene Ouroboros, also das Ergebnis der Bewegung. Nicht
             * ein Frame der Rückfahrt: welcher davon der richtige wäre, hängt
             * vom Fenster ab, und im Ruhemodus rechnet keine Kamera.
             */
            <img
              className="ebene ebene-bild"
              src={frameAdresse(satz, 99)}
              alt="Eine Hornviper hat sich im Sand zum geschlossenen Ring eingerollt — der Ouroboros, von oben gesehen."
            />
          ) : (
            <canvas
              ref={leinwand}
              className="ebene ebene-bild"
              /*
               * Die Adresse eines Frames der VOLLEN Stufe und der Aufbau, den
               * die Kamera gerechnet hat — damit ein Messgerät nachrechnen
               * kann, ohne dieselben Zahlen ein zweites Mal zu führen.
               */
              data-probe={frameAdresse(satz, 0)}
              data-aufbau={aufbau
                ? `${aufbau.rueckIndex},${aufbau.frames},${aufbau.ringPx.toFixed(2)},${aufbau.schwenk.toFixed(2)},${aufbau.grenze.toFixed(2)},${aufbau.ringX.toFixed(2)},${aufbau.ringY.toFixed(2)}`
                : undefined}
              role="img"
              aria-label="Eine Hornviper zieht durch die Düne, rollt sich ein und schließt sich zum Ouroboros. Die Bewegung folgt dem Scrollen."
            />
          )}

          {/*
            Der Staub der Ladeszene — in der Bühne, UNTER dem Schleier. Er
            gehört nicht der Ladeszene, sondern dem Bild; die Ladeszene malt
            nur darauf. Läge er darüber, käme der Schleier bei der Übergabe
            schlagartig dazu, und genau das war der gemessene Schnitt.
          */}
          {!ruhig && !uebergeben && (
            <canvas ref={staub} className="ebene lade-staub" aria-hidden="true" />
          )}

          <div ref={schleier} className="ebene ebene-schleier" />

          <div className="ebene ebene-text">
            <div className="ebene" ref={marke}>
              <Wortmarke text="OROBOROS" auf={auf} />
            </div>

            <p ref={hinweis} className={`hinweis${auf ? " auf" : ""}`}>Scrollen</p>

            {/*
              Das Lockup steht dort, wo der Film seinen Ring hat — nicht
              umgekehrt. Position und Größe kommen aus `kamera.ts`; hier steht
              nur, dass es eine Zeile ist.
            */}
            <div className="lockup" ref={lockup}>
              {ruhig ? (
                <Wortmarke text="OROBOROS" auf klasse="lockup-wort" />
              ) : (
                <>
                  <span className="lockup-ring" aria-hidden="true" />
                  <Wortmarke
                    text="ROBOROS"
                    auf={schriftAuf}
                    klasse="lockup-wort"
                    aussen={wort}
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
      </section>
    </div>
  );
}
