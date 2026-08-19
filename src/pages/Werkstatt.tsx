/**
 * /werkstatt — die Beweis-Route.
 *
 * Eine hässliche, ungestaltete Seite. Ihr einziger Zweck ist, die vier
 * Werkzeuge EINZELN vorzuführen: Spalter, Auftritt, Scrub, Nachziehen. Wer
 * hier Gestaltung sucht, sucht am falschen Ort — schwarzer Text auf Weiß,
 * Systemschrift, keine Bilder, keine Farbe.
 *
 * Diese Route bleibt dauerhaft im Template. In Kundenforks wird sie NICHT
 * gelöscht, sondern von der Indexierung ausgeschlossen (`noindex` steht in
 * `index.html`). Sie ist der Selbsttest des Werks: solange sie stimmt, stimmen
 * die Werkzeuge.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RUHIG_KLASSE } from "../motion/tokens";
import { auftritt, auftritteAufraeumen, auftritteVergessen } from "../motion/reveal";
import { scrubbe, scrubAufraeumen } from "../motion/scrub";
import { nachziehen } from "../motion/lerp";

const SCHRIFT = "16px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace";

/* ————————————————————————— Der Beweis selbst ————————————————————————— */

/**
 * Alles, was Bewegung anfasst, steckt hier drin — und wird vom Schalter über
 * einen neuen `key` vollständig neu aufgebaut. Ein Umschalten, das die alten
 * Zeitleisten stehen ließe, würde den Fallback gegen halb aufgebaute Bewegung
 * prüfen und wäre als Beleg wertlos.
 */
function Beweis() {
  const blockA = useRef<HTMLElement>(null);
  const blockB = useRef<HTMLElement>(null);
  const kasten = useRef<HTMLDivElement>(null);
  const punkt = useRef<HTMLDivElement>(null);

  // `useLayoutEffect`: der Auftritt muss angemeldet sein, BEVOR der Browser das
  // erste Bild zeichnet. Eine Bild später wäre der Container womöglich schon
  // sichtbar gewesen, ohne dass ihn jemand beobachtet hat.
  useLayoutEffect(() => {
    if (blockA.current) auftritt(blockA.current, { einmalig: false });
    if (blockB.current) auftritt(blockB.current, { einmalig: false });

    if (kasten.current) {
      scrubbe(
        kasten.current,
        { x: 0 },
        { x: () => window.innerWidth - (kasten.current?.offsetWidth ?? 0) - 32 },
        { pin: true },
      );
    }

    return () => {
      auftritteAufraeumen();
      scrubAufraeumen();
    };
  }, []);

  // Block D — der Punkt zieht dem Zeiger nach. Zwei Nachzieher, eine Schleife.
  useEffect(() => {
    const el = punkt.current;
    if (!el) return;
    let zeigerX = window.innerWidth / 2;
    let zeigerY = window.innerHeight / 2;
    let x = zeigerX;
    let y = zeigerY;
    const setzen = () => { el.style.transform = `translate3d(${x}px, ${y}px, 0)`; };

    const merken = (e: PointerEvent) => { zeigerX = e.clientX; zeigerY = e.clientY; };
    window.addEventListener("pointermove", merken, { passive: true });

    const stopX = nachziehen(() => zeigerX, (w) => { x = w; setzen(); });
    const stopY = nachziehen(() => zeigerY, (w) => { y = w; setzen(); });

    return () => {
      window.removeEventListener("pointermove", merken);
      stopX();
      stopY();
    };
  }, []);

  return (
    <>
      {/*
        * ————— Block A — Spalter + Auftritt, wortweise —————
        *
        * Die 40 vh Polster oben und unten sind kein Layout, sondern die
        * Bedingung des Beweises: jeder Block muss EINZELN in den 20-%-Bereich
        * geraten. Bei 8 rem Abstand stand Block B auf 1280 × 900 schon im
        * ersten Bild, sein Auftritt war beim Laden vorbei, und die Aufnahme
        * „vorher" zeigte das Ergebnis. Gemessen: berechnete Deckkraft 1 bei
        * `class="verborgen"`, 1,5 s nach dem Laden, ohne dass jemand gerollt
        * hätte.
        */}
      <section ref={blockA} style={{ padding: "40vh 2rem", maxWidth: "48rem" }}>
        <p style={{ margin: 0, opacity: 0.6 }}>Block A · split.ts + reveal.ts · data-rolle="schlagzeile"</p>
        <p
          data-rolle="schlagzeile"
          className="verborgen"
          style={{ font: "clamp(1.5rem, 5vw, 3rem)/1.15 inherit", margin: "1rem 0 0" }}
        >
          Jedes Wort tritt einzeln auf und der Screenreader liest den ganzen Satz.
        </p>
      </section>

      {/* ————— Block B — Karten-Staffel ————— */}
      <section ref={blockB} style={{ padding: "40vh 2rem" }}>
        <p style={{ margin: "0 0 1rem", opacity: 0.6 }}>Block B · reveal.ts · vier × data-rolle="karte"</p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              data-rolle="karte"
              className="verborgen"
              style={{
                width: "10rem", height: "7rem", background: "#d4d4d4",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </section>

      {/* ————— Block C — scrubbe mit pin ————— */}
      <section style={{ padding: "8rem 2rem 0" }}>
        <p style={{ margin: 0, opacity: 0.6 }}>Block C · scrub.ts · pin über 100 vh, ease „none"</p>
      </section>
      <section data-buehne style={{ height: "100vh", position: "relative", overflow: "hidden" }}>
        <div
          ref={kasten}
          style={{
            position: "absolute", top: "40vh", left: "2rem",
            width: "8rem", height: "8rem", background: "#000", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          scrub
        </div>
      </section>

      {/* ————— Block D — der nachziehende Punkt ————— */}
      <section style={{ padding: "8rem 2rem", minHeight: "60vh" }}>
        <p style={{ margin: 0, opacity: 0.6 }}>
          Block D · lerp.ts · der Punkt zieht dem Zeiger nach (Faktor --lerp)
        </p>
      </section>
      <div
        ref={punkt}
        aria-hidden="true"
        style={{
          position: "fixed", top: 0, left: 0, width: "1rem", height: "1rem",
          marginLeft: "-0.5rem", marginTop: "-0.5rem",
          background: "#000", borderRadius: "50%",
          pointerEvents: "none", zIndex: 10,
        }}
      />
    </>
  );
}

/* ————————————————————————————— Die Seite ————————————————————————————— */

export default function Werkstatt() {
  const [still, setStill] = useState(
    () => document.documentElement.classList.contains(RUHIG_KLASSE),
  );
  /** Erhöht sich bei jedem Umschalten und baut den Beweis vollständig neu auf. */
  const [lauf, setLauf] = useState(0);

  function umschalten() {
    const neu = !still;
    document.documentElement.classList.toggle(RUHIG_KLASSE, neu);
    setStill(neu);
    // Ohne dieses Vergessen bliebe ein bereits gelaufener Auftritt gelaufen,
    // und der Fallback wäre gegen einen Endzustand geprüft statt gegen eine
    // Bewegung, die es nicht gibt.
    auftritteVergessen();
    window.scrollTo(0, 0);
    setLauf((n) => n + 1);
  }

  return (
    <main style={{ font: SCHRIFT, color: "#000", background: "#fff" }}>
      <button
        type="button"
        onClick={umschalten}
        aria-pressed={still}
        style={{
          position: "fixed", top: "1rem", right: "1rem", zIndex: 20,
          font: "inherit", padding: "0.75rem 1rem",
          background: "#fff", color: "#000", border: "2px solid #000", cursor: "pointer",
        }}
      >
        Bewegung reduzieren: {still ? "AN" : "aus"}
      </button>

      <header style={{ padding: "4rem 2rem 0", maxWidth: "48rem" }}>
        <h1 style={{ font: "inherit", fontWeight: 700, margin: 0 }}>Werkstatt</h1>
        <p style={{ margin: "0.5rem 0 0" }}>
          Vier Blöcke, vier Werkzeuge. Keine Gestaltung — das ist Absicht.
        </p>
      </header>

      <Beweis key={lauf} />
    </main>
  );
}
