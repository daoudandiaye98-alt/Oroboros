/**
 * Die Landing — eine Route, eine Bühne, eine Bewegung.
 *
 * Ein Satz erodiert zu Sand, der Sand wird zum Sturm, der Sturm klart auf und
 * legt die Hornviper frei, die Kamera geht hoch — und übergibt an den Film:
 * die Viper zieht durch die Düne, verlangsamt, rollt sich ein, schließt zum
 * Ouroboros; dann fährt die Kamera zurück, bis der Ring so groß steht, wie ihn
 * das erste O des Wortes braucht. OROBOROS, dessen erster Buchstabe die
 * Schlange selbst ist — und das ist die erste und einzige Nennung der Marke.
 *
 * DIE GRÖSSE KOMMT AUS DER WAHL DES FRAMES, NICHT AUS EINER TRANSFORMATION.
 * Ein geschrumpftes Bild ist kleiner als sein Fenster und hat einen Rand;
 * dieser Rand war die sichtbare Kante. Bewegt wird nur noch innerhalb der
 * Overscan-Reserve — also innerhalb dessen, was `cover` ohnehin abschneidet.
 * Die Rechnung steht in `kamera.ts`, die Vermessung in `scripts/ring-messen.mjs`.
 *
 * WARUM DIE HELDENSEQUENZ KEIN `<video>` IST. Ein Video-Element ist für
 * Wiedergabe gebaut, nicht für Aufsuchen. `currentTime` zu setzen heißt: zum
 * nächsten Keyframe springen, dorthin dekodieren, ausgeben — je Bild, in beide
 * Richtungen. Eine Bildsequenz hat keinen Dekoderzustand. Der PROLOG ist
 * dagegen ein Film, weil er einmal vorwärts läuft; siehe `Prolog.tsx`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  canvasSpannen, entpackenVoraus, frameAdresse, frameStelle, ladeNachschub, ladeVorlauf,
  naechstesBild, vorratAuspacken, zeichneStelle, type Sequenz,
} from "../motion/sequenz";
import { bereich, buehneBeobachten } from "../motion/buehne";
import { ruhig as istRuhig } from "../motion/tokens";
import { choreografie, VORLAUF_SCHRITT, satzWaehlen, prologFilm } from "./choreografie";
import { aufbauRechnen, type Aufbau, type Ringdaten } from "./kamera";
import { Wortmarke } from "./Wortmarke";
import { Prolog } from "./Prolog";
import "../styles/landing.css";

/** Bei welcher Schriftgröße Wortbreite und Versalhöhe gemessen werden. */
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
  const [frei, setFrei] = useState(false);
  /** Nur für den Bericht und den Selbsttest: ist die volle Stufe komplett? */
  const [, setScharf] = useState(false);

  const kasten = useRef<HTMLElement>(null);
  const bild = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const schleier = useRef<HTMLDivElement>(null);
  const hinweis = useRef<HTMLParagraphElement>(null);
  const bruecke = useRef<HTMLParagraphElement>(null);
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
   * `ring.json` kommt VOR den Frames: erst mit ihr steht fest, WIE VIELE
   * Frames dieses Fenster überhaupt braucht. Die Datei ist wenige Kilobyte
   * groß und lädt, während der Satz noch steht.
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
   * ERST DIE SCHRIFT, DANN DIE KAMERA.
   *
   * Gemessen werden zwei Größen an der ECHTEN, GELADENEN Schrift: die Breite
   * von „ROBOROS" und die Versalhöhe. Aus der Versalhöhe folgt über das
   * Verhältnis 1,30 die Schriftgröße zum Ring, aus der Wortbreite die
   * Gesamtbreite und damit die Zentrierung.
   *
   * Gegen die Ersatzschrift gemessen ist beides falsch — Georgia ist deutlich
   * breiter als Jost 200 —, und das Lockup sitzt schief. Genau das benennt §6
   * als wahrscheinliche Ursache des Versatzes. Deshalb hängt unten ein
   * `document.fonts.ready` an der Messung, und deshalb wird nach dem Laden der
   * Schrift NEU gerechnet, nicht nur neu gezeichnet.
   */
  const vermessen = useCallback(() => {
    const kastenEl = bild.current, zeile = lockup.current, w = wort.current;
    if (!ringdaten || !kastenEl || !zeile || !w) return;
    const k = kastenEl.getBoundingClientRect();

    zeile.style.setProperty("--lockup-schrift", `${MESS_SCHRIFT}px`);
    const wortEm = w.getBoundingClientRect().width / MESS_SCHRIFT;
    const versalAnteil = versalMessen(getComputedStyle(w).fontFamily);
    if (!wortEm || !versalAnteil) return;

    // Der sichere Rand: Gestaltungsmaß plus das, was das Gerät sich nimmt.
    const st = sicher.current ? getComputedStyle(sicher.current) : null;
    const einzug = st ? Math.max(parseFloat(st.paddingLeft) || 0, parseFloat(st.paddingRight) || 0) : 0;
    /*
     * Das Gestaltungsmaß war 5 % der Fensterbreite, gedeckelt bei 72 px.
     *
     * Auf 1440 px waren das 72 px je Seite — für eine Wortmarke, die das
     * Schlussbild tragen soll, viel. Auf 390 px nahm es der Zeile die letzten
     * Bildpunkte, die sie zum Wachsen gebraucht hätte: sie stand dort schon
     * auf 89 % der Breite. 3,5 % lassen der Marke Luft und geben ihr
     * gleichzeitig Platz; der Geräteeinzug kommt unverändert obendrauf.
     */
    const rand = Math.max(12, Math.min(56, k.width * 0.035)) + einzug;

    const a = aufbauRechnen(ringdaten, k.width, k.height, rand, wortEm, versalAnteil);
    if (!a) {
      // Kein Frame trägt dieses Fenster. Nicht kaschieren: melden, und die
      // Zeile bleibt fort. Dann fehlt Bildmaterial, und das ist keine
      // Codefrage — siehe Bericht.
      console.error("Oroboros: kein Frame passt in dieses Fenster", k.width, k.height);
      setAufbau(null);
      aufbauRef.current = null;
      return;
    }

    zeile.style.setProperty("--ring-mass", `${a.ringD}px`);
    zeile.style.setProperty("--lockup-schrift", `${a.schriftPx}px`);
    zeile.style.left = `${a.linkeKante}px`;
    zeile.style.top = `${a.ringY}px`;

    /*
     * DAS SIEGEL WEICHT DEM RING AUS — SENKRECHT, NICHT SEITLICH.
     *
     * §6 gibt „DESIGN", Strich und Satz die Fenstermitte als Achse. Das ist
     * die WAAGERECHTE Achse, und sie bleibt. Nur ist auf 844 × 390 unter dem
     * Ring, der dort 122 px misst, nicht genug Höhe für einen dreizeiligen
     * Block an der Fensterunterkante: „DESIGN" lief mitten durch den Ring.
     * Kein Messwert hat das gemeldet — Kontrast, Ränder und Achse waren alle
     * in Ordnung. Gesehen hat es die Aufnahme.
     *
     * Der Block bekommt deshalb seinen Platz UNTER dem Ring zugewiesen, wenn
     * er dort hinpasst, und darf dafür einzeilig werden. Passt er auch dann
     * nicht, bleibt der Anker aus dem Stylesheet — dann ist unten mehr Platz
     * als neben dem Ring, und die Aufnahme zeigt es.
     */
    const u = unten.current;
    const satzEl = u?.querySelector<HTMLElement>(".siegel-satz") ?? null;
    if (u) {
      u.style.removeProperty("top");
      u.style.removeProperty("bottom");
      if (satzEl) satzEl.style.removeProperty("max-width");
      /*
       * Der SICHTBARE Ring ist größer als der gemessene.
       *
       * Gemessen wird der Körper der Schlange. Um ihn liegt der Krater, den
       * sie in den Sand gedrückt hat, mit seinen Schattenringen — in den
       * gewählten Frames rund das 1,6-fache. Auf 844 × 390 stand „DESIGN"
       * rechnerisch einen Bildpunkt unter dem Ring und in der Aufnahme mitten
       * auf dem Kraterrand. Der Abstand rechnet deshalb mit dem Krater.
       */
      const ringUnten = a.ringY + a.ringD * 0.8;
      const luft = Math.max(10, k.height * 0.03);
      const untenRand = Math.max(12, k.height * 0.04);
      if (u.getBoundingClientRect().top < ringUnten + 8) {
        // Einzeilig ist der Block rund ein Drittel flacher. Erst danach messen.
        if (satzEl) satzEl.style.maxWidth = "none";
        const hoch = u.getBoundingClientRect().height;
        if (ringUnten + luft + hoch <= k.height - untenRand) {
          u.style.top = `${ringUnten + luft}px`;
          u.style.bottom = "auto";
        } else if (satzEl) {
          satzEl.style.removeProperty("max-width");
        }
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
     * rechnet mit den richtigen.
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
   * ZWEI STUFEN. Zuerst der Vorlauf: jeder vierte Frame, klein und grob.
   * Sobald er da ist, darf der Prolog übergeben. Danach strömt die volle
   * Auflösung nach und ersetzt die Frames einzeln, während gescrollt wird.
   *
   * Geladen wird nur bis zum Frame, an dem die Bühne endet.
   */
  const gestartet = useRef(false);
  useEffect(() => {
    if (ruhig) { setFrei(true); setUebergeben(true); setAuf(true); return; }
    if (!aufbau || gestartet.current) return;
    gestartet.current = true;
    const s = ladeVorlauf(`${satz}-vor`, aufbau.frames, VORLAUF_SCHRITT, {
      beiFertig: () => { setSeq(s); setFrei(true); },
    });
  }, [satz, ruhig, aufbau]);

  /*
   * DER NACHSCHUB BEKOMMT EINEN EIGENEN EFFEKT, und das ist kein Aufräumen.
   *
   * Er stand vorher im Effekt oben, gestartet aus `beiFertig`. Dessen
   * Abhängigkeiten enthielten `seq` — und genau dieses `seq` setzt `beiFertig`.
   * Also lief der Effekt neu, sein Aufräumen rief `stoppen()`, und der
   * Nachschub endete nach sechs von 141 Frames. Sichtbar war das nicht als
   * Fehler, sondern als matschiges Schlussbild.
   */
  useEffect(() => {
    if (ruhig || !seq) return;
    let vorratStoppen: (() => void) | null = null;
    const stoppen = ladeNachschub(satz, seq, {
      beiErsatz: (fertig, von) => {
        if (fertig < von) return;
        setScharf(true);
        /*
         * Die scharfen Frames sind da — und der Prolog läuft noch. Diese
         * Sekunden gehören dem Auspacken: der Anfang der Sequenz wird in den
         * Pausen des Hauptfadens dekodiert, damit das erste Rollen nicht
         * dasselbe unter Zeitdruck tun muss. Gemessen war genau das der
         * Unterschied zwischen 39 und 60 Bildern je Sekunde.
         */
        vorratStoppen = vorratAuspacken(seq, seq.anzahl);
      },
    });
    return () => { stoppen(); vorratStoppen?.(); };
  }, [seq, satz, ruhig]);

  /** Der Auftritt zündet erst, wenn der Prolog übergeben hat. */
  useEffect(() => {
    if (!uebergeben || auf) return;
    const id = requestAnimationFrame(() => setAuf(true));
    return () => cancelAnimationFrame(id);
  }, [uebergeben, auf]);

  /*
   * Solange der Prolog läuft, ist die Seite festgehalten.
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

      /*
       * Die Brücke: eine Zeile, die auftaucht und wieder geht.
       *
       * Kein Ein- und Ausblenden über zwei Fenster, sondern ein Sinus über
       * EINES: bei 0 ist sie fort, in der Mitte steht sie ganz, am Ende ist
       * sie wieder fort. Dazu ein kurzer Weg nach oben — dieselbe Richtung,
       * in die der Sand im Prolog zieht, damit die Zeile aus derselben
       * Bewegung kommt und nicht aus einer eigenen.
       */
      if (bruecke.current) {
        const h = bereich(p, c.bruecke[0], c.bruecke[1]);
        const da = h > 0 && h < 1 ? Math.sin(h * Math.PI) : 0;
        bruecke.current.style.opacity = String(da);
        bruecke.current.style.transform = `translateY(${((1 - da) * 14).toFixed(2)}px)`;
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
        unten.current.style.transform = `translateY(${(1 - s) * c.siegelWeg}px)`;
      }

      const cv = leinwand.current;
      const auf2 = aufbauRef.current;
      if (!cv || !seq || !auf2) return;

      /*
       * Der Film — und der Schwenk.
       *
       * Der Schwenk ist die EINZIGE Bewegung, die das Bild erfährt. Er bleibt
       * per Bauart innerhalb der Overscan-Reserve; siehe `kamera.ts`.
       */
      const schwenk = auf2.schwenk * a;
      const anteil = bereich(p, c.film[0], c.film[1]);
      const anzahl = Math.min(auf2.frames, geladen.current || auf2.frames);
      const stelle = frameStelle(anteil, anzahl);
      const jetzt = stelle.i + Math.round(stelle.t * 10) / 10;
      const neu = canvasSpannen(cv, naechstesBild(seq, stelle.i));
      if (jetzt === letzterFrame && schwenk === letzterSchwenk && !neu) return;
      /*
       * Das Auspacken läuft der Kamera voraus.
       *
       * Nur bei einem Frame-WECHSEL, nicht je Bild: sonst würden zwölf
       * `decode()` je Bild gerufen, und das ist selbst wieder Arbeit. Warum
       * überhaupt — siehe `entpackenVoraus` in `motion/sequenz.ts`.
       */
      if (Math.floor(jetzt) !== Math.floor(letzterFrame)) {
        entpackenVoraus(seq, stelle.i, jetzt >= letzterFrame ? 1 : -1, anzahl);
      }
      letzterFrame = jetzt;
      letzterSchwenk = schwenk;
      zeichneStelle(cv, seq, anteil, true, schwenk, anzahl);
    });
  }, [seq, ruhig]);

  /*
   * Der erste Frame muss stehen, BEVOR der Prolog übergibt.
   *
   * Die Bühnenschleife oben zeichnet erst, wenn gescrollt oder die Größe
   * geändert wird — und während des Prologs passiert beides nicht. Ohne diesen
   * einen Aufruf übergäbe der Film an eine leere Fläche.
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
        <Prolog bereit={frei} film={prologFilm(satz)} ruhig={ruhig} beiUebergabe={uebergabe} />
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
                ? [aufbau.rueckIndex, aufbau.frames, aufbau.ringD.toFixed(2), aufbau.schwenk.toFixed(2),
                   aufbau.grenze.toFixed(2), aufbau.ringX.toFixed(2), aufbau.ringY.toFixed(2),
                   aufbau.gesamtB.toFixed(2), aufbau.linkeKante.toFixed(2),
                   aufbau.mittenAbweichung.toFixed(2), aufbau.ringZuVersal.toFixed(3),
                   aufbau.schriftPx.toFixed(2), aufbau.optischeAbweichung.toFixed(2),
                   aufbau.schwerpunktX.toFixed(2)].join(",")
                : undefined}
              role="img"
              aria-label="Eine Hornviper zieht durch die Düne, rollt sich ein und schließt sich zum Ouroboros. Die Bewegung folgt dem Scrollen."
            />
          )}

          <div ref={schleier} className="ebene ebene-schleier" />

          <div className="ebene ebene-text">
            {/*
              §5 — DER ROLLHINWEIS.

              Erst stand hier ein kleiner Ring mit wanderndem Bogen — die
              Figur der Seite, klein und in Bewegung. Die Abnahme hat ihn
              zurückgewiesen, und zu Recht: §4 verlangt, dass VOR dem
              Schlussbild kein Ring zu sehen ist. Ein Ring am unteren Rand
              nimmt dem Schluss genau das vorweg, was ihn zum Schluss macht.

              Also die andere Sprache dieser Seite, die des Prologs: der Wind,
              der über Sand geht. Durch das Wort läuft ein Zug von links nach
              rechts — dieselbe Richtung, in die die Schrift im Prolog
              zerfällt. Keine neue Form, kein Pfeil, kein Springen: nur das
              Wort und der Wind darin.
            */}
            <p ref={hinweis} className={`hinweis${auf ? " auf" : ""}`}>
              <span className="hinweis-wort">Scrollen</span>
            </p>

            {/*
              §6 — DIE EINE ZEILE.
              Der Prolog endet mit „because you are ready for the next step".
              Diese Zeile stellt die Frage, auf die dieser Satz die Antwort
              ist. Sie steht allein, ohne Unterzeile, ohne Schaltfläche, und
              sie ist fort, bevor der Ring sich schließt.
            */}
            <p ref={bruecke} className="bruecke" lang="en" style={{ opacity: 0 }}>
              Afraid of what’s next?
            </p>

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

            {/*
              „DESIGN", der Strich und der Satz stehen mittig auf `achseX` —
              also auf der Fenstermitte, nicht unter dem Ring und nicht unter
              dem Wort. §6: sie haben ihre eigene Achse, und die ist die des
              Fensters. Das steht im Stylesheet (`left: 0; right: 0`), damit
              hier keine Zahl doppelt geführt wird.
            */}
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

/**
 * Die Versalhöhe der geladenen Schrift, in em.
 *
 * Gemessen an einem „R" über `actualBoundingBoxAscent` — nicht aus einer
 * Tabelle. §6 rechnet mit Jost 200: Ring 57 px zu Schrift 61 px ergibt 0,719;
 * gemessen sind 0,700. Der Unterschied ist die Definition von Versalhöhe im
 * Schriftschnitt gegen die tatsächliche Oberkante des Buchstabens — drei
 * Prozent, und gemessen ist gemessen.
 */
function versalMessen(familie: string): number {
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return 0.7;
  c.font = `200 ${MESS_SCHRIFT}px ${familie}`;
  const m = c.measureText("R");
  const h = m.actualBoundingBoxAscent;
  return Number.isFinite(h) && h > 0 ? h / MESS_SCHRIFT : 0.7;
}
