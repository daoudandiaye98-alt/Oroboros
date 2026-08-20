/**
 * Die Ladeszene — und der Übergang in den Film.
 *
 * Sie hat zwei Aufgaben, und beide sind wichtiger, als sie aussehen.
 *
 * ERSTENS: NICHTS IST SCROLLBAR, BEVOR DIE FRAMES DA SIND. Eine Sequenz, der
 * Frames fehlen, springt beim Scrollen — und ein Sprung sieht aus wie ein
 * Fehler, nicht wie ein Ladezustand.
 *
 * ZWEITENS: DIE WARTEZEIT GEHÖRT ZUR SEITE. Bis Phase 2 stand hier ein Kreis
 * mit einer Prozentzahl darin. Der sagte ehrlich, wie weit das Laden war, und
 * genau darin lag der Fehler: er sprach über die Technik, nicht über das Werk.
 * Jetzt zeichnet sich der Ouroboros, ein Satz steht darunter, und wenn die
 * Frames da sind, zerfällt die Linie zu Staub, der sich zum ersten Bild des
 * Films setzt. Man sieht keinen Übergang von einer Ladeseite zur Seite — man
 * sieht eine Bewegung, die durchläuft.
 *
 * DIE FÜNF SCHLÄGE.
 *   A zerfall   Die Linie bricht auf. Der Staub steht noch, wo sie stand.
 *   B trift     Er treibt auseinander und nimmt die Farben des Films an.
 *   C fall      Er fällt und wird langsamer, wie Sand, der sich legt.
 *   D setzen    Er ordnet sich zum ersten Bild; darunter kommt der Film.
 *   E uebergabe Er verschwindet. Was bleibt, ist die Düne.
 *
 * Die Dauern stehen in `bewegung.css`, nicht hier — auch diese fünf.
 */
import { useEffect, useRef, useState } from "react";
import { dauer } from "../motion/tokens";
import type { Farbprobe } from "../motion/sequenz";

/** Wie viele Körner. Am oberen Ende dessen, was ein Telefon je Bild schafft. */
const KOERNER = 3000;

/** Die Schläge, in ihrer Reihenfolge, mit dem Namen ihres Tokens. */
const SCHLAEGE = [
  { name: "zerfall", token: "--schlag-a" },
  { name: "trift", token: "--schlag-b" },
  { name: "fall", token: "--schlag-c" },
  { name: "setzen", token: "--schlag-d" },
  { name: "uebergabe", token: "--schlag-e" },
] as const;

export interface LadeschirmEigenschaften {
  /** Sind die Frames da? */
  bereit: boolean;
  /** Die Farbprobe aus dem ERSTEN Frame — Quelle der Staubfarben. */
  farben: Farbprobe | null;
  /** Ruhemodus: kein Staub, nur halten und blenden. */
  ruhig: boolean;
  /** Gerufen, wenn der Übergang durch ist und die Seite gehört. */
  beiUebergabe: () => void;
}

/** Weiches Ein- und Ausblenden innerhalb eines Schlags: 0 → 1 → 0. */
const bogen = (t: number) => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);

export function Ladeschirm({ bereit, farben, ruhig, beiUebergabe }: LadeschirmEigenschaften) {
  const staub = useRef<HTMLCanvasElement>(null);
  const marke = useRef<SVGSVGElement>(null);
  const [zug, setZug] = useState(false);
  const [schlag, setSchlag] = useState<string | null>(null);
  const [zerfallen, setZerfallen] = useState(false);
  const [weg, setWeg] = useState(false);
  /** Wann der Zug begonnen hat — der Staub darf ihn nicht abschneiden. */
  const begonnen = useRef(0);

  /*
   * Der Zug beginnt im nächsten Bild, nicht sofort.
   *
   * Ein Übergang zündet nur, wenn der Browser den Anfangswert einmal gesehen
   * hat. Setzte man `data-zug` schon beim ersten Rendern, stünde die Linie
   * fertig da und niemand sähe sie sich schreiben.
   */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      begonnen.current = performance.now();
      setZug(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /* ————————————————————————— Der ruhige Pfad ————————————————————————— */

  /*
   * Kein Staub, keine fünf Schläge: halten, blenden, fort.
   *
   * Wer „Bewegung reduzieren" gesetzt hat, bekommt nicht dieselbe Szene in
   * langsam — er bekommt eine andere. Dreitausend fliegende Körner sind genau
   * das, was diese Einstellung meint.
   */
  useEffect(() => {
    if (!ruhig || !bereit) return;
    const zeit = dauer("--ruhe-halt") + dauer("--ruhe-blende");
    const id = window.setTimeout(() => { setWeg(true); beiUebergabe(); }, zeit);
    return () => window.clearTimeout(id);
  }, [ruhig, bereit, beiUebergabe]);

  /* ————————————————————————— Der Staub ————————————————————————— */

  useEffect(() => {
    if (ruhig || !bereit) return;
    const cv = staub.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const takte = SCHLAEGE.map((s) => dauer(s.token));
    const gesamt = takte.reduce((a, b) => a + b, 0);
    /* Erst zeichnen, dann zerfallen. Sind die Frames vor dem Ende des Zuges
       da, wartet der Staub — sonst risse er der Marke den Stift aus der Hand. */
    const rest = Math.max(0, dauer("--zeichnen-marke") - (performance.now() - begonnen.current));

    let laeuft = true;
    let id = 0;
    const starten = () => {
      const dichte = Math.min(window.devicePixelRatio || 1, 2);
      let bb = 0, bh = 0;
      const spannen = () => {
        bb = cv.clientWidth; bh = cv.clientHeight;
        cv.width = Math.round(bb * dichte);
        cv.height = Math.round(bh * dichte);
        ctx.setTransform(dichte, 0, 0, dichte, 0, 0);
      };
      spannen();

      /*
       * Die Körner.
       *
       * Ein `Float32Array` je Größe statt dreitausend Objekte: die Schleife
       * läuft sechzigmal je Sekunde über alle, und ein Feld von Objekten
       * bedeutet dabei dreitausend Zeigerverfolgungen je Bild.
       *
       * `zx`/`zy` ist das ZIEL: die Stelle, an der das Korn am Ende von Schlag
       * D stehen wird. Sie kommt aus derselben Probe wie seine Farbe — das
       * Kornfeld ist am Schluss also buchstäblich eine grobe Fassung des
       * ersten Frames, und darunter blendet der echte Frame auf. Ohne diese
       * Kopplung setzte sich bunter Staub vor ein Bild, mit dem er nichts zu
       * tun hätte.
       */
      const x = new Float32Array(KOERNER), y = new Float32Array(KOERNER);
      const vx = new Float32Array(KOERNER), vy = new Float32Array(KOERNER);
      const zx = new Float32Array(KOERNER), zy = new Float32Array(KOERNER);
      const gr = new Float32Array(KOERNER);
      /* Je Korn ein eigenes Tempo — sonst bleibt der Ring beim Auseinandertreiben
         ein Ring, nur größer. Er soll zu einer Wolke werden. */
      const tempo = new Float32Array(KOERNER);
      const farbe: string[] = new Array(KOERNER);

      const raster = farben?.raster ?? 0;
      const deckung = raster > 0 ? Math.max(bb / raster, bh / raster) : 0;
      const rx = (bb - raster * deckung) / 2;
      const ry = (bh - raster * deckung) / 2;

      /*
       * Der Staub beginnt dort, wo die LINIE steht — gemessen, nicht geraten.
       *
       * Die Marke steht nicht in der Bildmitte: unter ihr sitzt der Satz, und
       * die Spalte ist als Ganzes zentriert. Rechnete man mit der Mitte des
       * Fensters, bräche die Linie an einer Stelle auf und der Staub entstünde
       * an einer anderen. Der Radius ist ebenfalls gemessen: der Bogen hat im
       * viewBox 40 einen Radius von 17, also 0,425 der Kastenbreite.
       */
      const mk = marke.current?.getBoundingClientRect();
      const mx = mk ? mk.left + mk.width / 2 : bb / 2;
      const my = mk ? mk.top + mk.height / 2 : bh / 2;
      const radius = (mk ? mk.width : 80) * 0.425;

      for (let i = 0; i < KOERNER; i++) {
        // Start: auf dem Ring der Marke, dort, wo die Linie eben noch stand.
        const w = (i / KOERNER) * Math.PI * 2;
        const streu = 0.9 + Math.random() * 0.2;
        x[i] = mx + Math.cos(w) * radius * streu;
        y[i] = my + Math.sin(w) * radius * streu;
        vx[i] = 0; vy[i] = 0;
        gr[i] = 0.6 + Math.random() * 1.5;
        tempo[i] = 0.45 + Math.random() * 1.25;
        if (raster > 0 && farben) {
          const z = i % (raster * raster);
          const sx = z % raster, sy = Math.floor(z / raster);
          /*
           * Innerhalb der Zelle gestreut, nicht auf ihren Mittelpunkt.
           *
           * Fünf Körner je Zelle auf denselben Punkt zu legen ergibt ein
           * sichtbares Gitter aus 576 Punkten — gemessen auf 1440 × 900 war
           * genau das zu sehen, und es sah nach Raster aus, nicht nach Sand.
           */
          zx[i] = rx + (sx + Math.random()) * deckung;
          zy[i] = ry + (sy + Math.random()) * deckung;
          const p = z * 3;
          farbe[i] = `rgb(${farben.punkte[p]},${farben.punkte[p + 1]},${farben.punkte[p + 2]})`;
        } else {
          // Ohne Probe bleibt der Staub cremefarben und geht zur Mitte. Das
          // ist ärmer, aber es ist kein Sonderfall im Ablauf.
          zx[i] = bb / 2; zy[i] = bh / 2;
          farbe[i] = "#F4EDE2";
        }
      }

      const auf = performance.now();
      let voriges = auf;
      const bild = (jetzt: number) => {
        if (!laeuft) return;
        const dt = Math.min(0.05, (jetzt - voriges) / 1000);
        voriges = jetzt;
        const abgelaufen = jetzt - auf;

        // Welcher Schlag, und wie weit ist er?
        let k = 0, rand = 0;
        while (k < takte.length - 1 && abgelaufen > rand + takte[k]) { rand += takte[k]; k++; }
        const t = Math.min(1, (abgelaufen - rand) / Math.max(1, takte[k]));
        const name = SCHLAEGE[k].name;
        setSchlag((v) => (v === name ? v : name));
        setZerfallen((v) => v || true);

        if (bb !== cv.clientWidth || bh !== cv.clientHeight) spannen();
        ctx.clearRect(0, 0, bb, bh);

        for (let i = 0; i < KOERNER; i++) {
          switch (name) {
            case "zerfall": {
              // Auseinanderbrechen: nach außen, leicht, noch fast an Ort.
              const w = Math.atan2(y[i] - my, x[i] - mx);
              vx[i] += Math.cos(w) * 26 * tempo[i] * dt;
              vy[i] += Math.sin(w) * 26 * tempo[i] * dt;
              break;
            }
            case "trift": {
              // Treiben: Wirbel und Auffächern über die ganze Fläche.
              const w = Math.atan2(y[i] - my, x[i] - mx);
              vx[i] += (Math.cos(w) * 120 * tempo[i] + Math.cos(i) * 70) * dt;
              vy[i] += (Math.sin(w) * 120 * tempo[i] + Math.sin(i * 1.7) * 70) * dt;
              break;
            }
            case "fall": {
              // Fallen und ruhiger werden — Sand, der sich legt.
              vy[i] += 210 * dt;
              vx[i] *= 1 - 1.7 * dt;
              vy[i] *= 1 - 0.7 * dt;
              break;
            }
            case "setzen": {
              // Ans Ziel ziehen, zeitnormiert wie überall im Projekt.
              const f = 1 - Math.pow(1 - 0.12, dt * 60);
              x[i] += (zx[i] - x[i]) * f;
              y[i] += (zy[i] - y[i]) * f;
              vx[i] *= 1 - 6 * dt;
              vy[i] *= 1 - 6 * dt;
              break;
            }
            default: {
              const f = 1 - Math.pow(1 - 0.18, dt * 60);
              x[i] += (zx[i] - x[i]) * f;
              y[i] += (zy[i] - y[i]) * f;
              break;
            }
          }
          x[i] += vx[i] * dt;
          y[i] += vy[i] * dt;
        }

        /*
         * Deckkraft je Schlag.
         *
         * A steigt an (der Staub entsteht), B und C stehen, D beginnt zu
         * weichen, E geht auf null. Ohne dieses Nachlassen läge am Ende ein
         * grobes Kornbild über einem scharfen Frame — man sähe die Rasterung.
         */
        const deck =
          name === "zerfall" ? Math.min(1, t * 2.2)
          : name === "setzen" ? 1 - t * 0.35
          : name === "uebergabe" ? Math.max(0, 0.65 * (1 - Math.min(1, t * 1.35)))
          : 1;

        ctx.globalAlpha = deck;
        for (let i = 0; i < KOERNER; i++) {
          ctx.fillStyle = farbe[i];
          ctx.fillRect(x[i], y[i], gr[i], gr[i]);
        }
        ctx.globalAlpha = 1;

        // Ein leiser Schimmer beim Zerfall, damit der Bruch nicht hart ist.
        if (name === "zerfall") {
          ctx.globalAlpha = bogen(t) * 0.12;
          ctx.fillStyle = "#F4EDE2";
          ctx.fillRect(0, 0, bb, bh);
          ctx.globalAlpha = 1;
        }

        if (abgelaufen >= gesamt) {
          laeuft = false;
          setWeg(true);
          beiUebergabe();
          return;
        }
        id = requestAnimationFrame(bild);
      };
      id = requestAnimationFrame(bild);
    };

    const warten = window.setTimeout(starten, rest);
    return () => {
      laeuft = false;
      window.clearTimeout(warten);
      cancelAnimationFrame(id);
    };
  }, [ruhig, bereit, farben, beiUebergabe]);

  if (weg) return null;

  /*
   * `data-grund` gibt den Film frei, sobald sich der Staub setzt.
   *
   * Ab Schlag D liegt unter dem Staub der erste Frame; bliebe der schwarze
   * Grund stehen, setzte sich der Staub vor eine schwarze Fläche und der Film
   * erschiene am Ende hart.
   */
  const grundWeg = schlag === "setzen" || schlag === "uebergabe";

  return (
    <div
      className="ladeschirm"
      data-fertig={bereit ? "ja" : "nein"}
      data-zug={zug ? "ja" : "nein"}
      data-ruhig={ruhig ? "ja" : "nein"}
      data-schlag={schlag ?? "kein"}
      data-zerfallen={zerfallen ? "ja" : "nein"}
      data-grund={grundWeg ? "weg" : "da"}
      aria-hidden={bereit}
    >
      <div className="ladeschirm-inhalt">
        <svg ref={marke} className="lade-marke" viewBox="0 0 40 40" aria-hidden="true">
          {/*
            Ein Bogen über 350°, der am Kopf beginnt und dort wieder ankommt —
            die Schlange, die sich in den Schwanz beißt. `pathLength` normiert
            ihn auf 100, damit das Stylesheet in Prozent zählen kann.
          */}
          <path
            className="lade-zug"
            pathLength={100}
            d="M 20 3 A 17 17 0 1 1 17.05 3.26"
          />
          <circle className="lade-kopf" cx="20" cy="3" r="2.4" />
        </svg>
        <p className="lade-satz">because you are ready for the next step</p>
      </div>
      {!ruhig && <canvas ref={staub} className="lade-staub" aria-hidden="true" />}
    </div>
  );
}
