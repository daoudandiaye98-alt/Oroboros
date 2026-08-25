/**
 * Abschnitt 04 — STORY: die fünf Epochen.
 *
 * Der erste Abschnitt, der aus dem Release entsteht statt aus einem
 * Bauauftrag im Chat. Was er zeigt, steht in `epochen.ts`; wie er sich
 * bewegt, steht in `bewegung.css`. In dieser Datei steht **keine Zahl** —
 * das ist das Gesetz aus Phase 0, und dieser Abschnitt ist der erste, der es
 * unter Beweis stellt, ohne dass jemand ihn dabei beaufsichtigt hat.
 *
 * DAS SCHARNIER. Die Linie, die die Stationen verbindet, ist nicht Zierat:
 * sie teilt sich, solange getrennt wird (solve), und schließt sich, sobald
 * gebunden wird (coagula). Gezeichnet als SVG, scrollgebunden über `scrubbe`
 * — eine einzige Bewegung für den ganzen Abschnitt. `stroke-dashoffset`,
 * weil das der einzige Weg ist, eine Linie **wachsen** zu lassen, statt sie
 * einzublenden.
 *
 * WARUM NUR EINE BEWEGUNG. Fünf Stationen mit je einer Enthüllung plus fünf
 * gescrubbte Linien wären zehn Auslöser für einen Gedanken. Die Enthüllungen
 * hängen am `auftritt`-Gesetz (ein Beobachter, kein Rechenweg), das Scharnier
 * an genau einem Auslöser.
 */
import { useEffect, useRef } from "react";
import { auftritt } from "../motion/reveal";
import { scrubbe } from "../motion/scrub";
import { EPOCHEN, SCHARNIER } from "./epochen";

/**
 * Die Länge der gezeichneten Bahn.
 *
 * Eine runde Zahl, kein Maß: `stroke-dasharray` und `stroke-dashoffset`
 * rechnen in Benutzereinheiten des `viewBox`, und die Bahn wird über
 * `pathLength` auf genau diesen Wert normiert. Damit stimmt die Rechnung
 * unabhängig davon, wie lang die Bahn geometrisch wirklich ist — und
 * unabhängig davon, wie hoch der Abschnitt auf einem Telefon wird.
 */
const BAHN = 1000;

/**
 * Wo eine Station am Scharnier hängt.
 *
 * Nicht Gestaltung, sondern dieselbe Struktur, die den Pfad zeichnet: der
 * Stamm läuft bis zur Teilung, die Zweige liegen links und rechts davon, die
 * Naht führt zurück in die Mitte. Das Stylesheet liest es als `data-zweig`
 * und muss dafür nicht wissen, welche Epoche die dritte ist.
 */
export type Zweig = "stamm" | "links" | "rechts" | "naht";

/**
 * Die Zweige aus den Phasen ableiten — einmal für die ganze Liste.
 *
 * Die erste `solve`-Station steht auf dem Stamm: bis dorthin hat sich noch
 * nichts geteilt. Ab der zweiten wechseln sich die Seiten ab. Jede
 * `coagula`-Station steht auf der Naht, also wieder mittig.
 *
 * Abgeleitet, nicht in `epochen.ts` hinterlegt: dort steht, WAS eine Epoche
 * ist. Käme eine sechste dazu, verteilt sich die Trennung von selbst richtig
 * — hinterlegt müsste sie jemand nachziehen, und niemand würde es merken.
 */
function zweige(epochen: readonly { phase: "solve" | "coagula" }[]): Zweig[] {
  let getrennt = 0;
  return epochen.map((e) => {
    if (e.phase === "coagula") return "naht";
    getrennt += 1;
    if (getrennt === 1) return "stamm";
    return getrennt % 2 === 0 ? "links" : "rechts";
  });
}

export default function Epochen() {
  const abschnitt = useRef<HTMLElement>(null);
  const bahn = useRef<SVGPathElement>(null);
  const naht = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = abschnitt.current;
    if (!el) return;
    for (const station of el.querySelectorAll<HTMLElement>("[data-station]")) {
      auftritt(station);
    }
  }, []);

  useEffect(() => {
    const el = abschnitt.current;
    const linie = bahn.current;
    const schluss = naht.current;
    if (!el || !linie || !schluss) return;

    /*
     * Trennen: die Bahn wächst von oben nach unten mit.
     * Binden: die Naht schließt den Kreis am Ende.
     *
     * Zwei Bewegungen auf einem Auslöser, nicht zwei Auslöser: sie sind
     * dieselbe Aussage in zwei Hälften, und getrennt ausgelöst würden sie
     * irgendwann auseinanderlaufen.
     */
    /*
     * `end: "bottom 65%"` — und diese Angabe ist gemessen, nicht gewählt.
     *
     * Mit der Grundeinstellung (`"bottom top"`) wird eine Linie fertig, sobald
     * sie oben aus dem Bild ist. Der Prüfstand hat nachgesehen, wo die Naht
     * `strokeDashoffset` 0 erreicht: bei einer Schließstelle von −24 px, also
     * gerade über der Fensterkante. Der Kreis schloss sich — außerhalb des
     * Bildes. Eine Bewegung, die nur der Rechner sieht, ist keine.
     *
     * Bei 65 % steht die Schließstelle rund 585 px unter der Oberkante, wenn
     * die Naht zugeht. Kein Zeitwert, kein Kurvenwert: es steht hier und
     * nicht in `bewegung.css`, weil es Geometrie dieses Abschnitts ist und
     * für keinen anderen gilt.
     */
    const STRECKE = { scrub: true, end: "bottom 65%" } as const;
    const wachsen = scrubbe(
      linie as unknown as HTMLElement,
      { strokeDashoffset: BAHN },
      { strokeDashoffset: 0 },
      STRECKE,
    );
    const schliessen = scrubbe(
      schluss as unknown as HTMLElement,
      { strokeDashoffset: BAHN },
      { strokeDashoffset: 0 },
      STRECKE,
    );
    return () => {
      wachsen?.kill();
      schliessen?.kill();
    };
  }, []);

  const zweig = zweige(EPOCHEN);

  return (
    <section
      className="epochen"
      ref={abschnitt}
      aria-labelledby="epochen-titel"
      data-abschnitt="story"
      data-release="1cfca5a5-dba8-4535-81a5-f0b5260e878f"
    >
      <div className="epochen-kopf" data-station data-auftritt="epochen-kopf">
        <p className="kicker verborgen" data-rolle="marginalie">Fünf Epochen</p>
        <h2 className="epochen-titel verborgen" id="epochen-titel" data-rolle="schlagzeile">
          Dasselbe Zeichen, dreitausend Jahre
        </h2>
      </div>

      {/*
        Das Scharnier liegt HINTER den Stationen, nicht zwischen ihnen. Eine
        Linie, die sich durch den Text schlängelt, wäre Dekoration; eine, die
        dahinter durchläuft, ist ein Rücken.
      */}
      <svg
        className="scharnier"
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          ref={bahn}
          className="scharnier-bahn"
          pathLength={BAHN}
          strokeDasharray={BAHN}
          strokeDashoffset={BAHN}
          d="M50 0 L50 300 M50 300 L20 480 M50 300 L80 480 M20 480 L20 620 M80 480 L80 620"
        />
        <path
          ref={naht}
          className="scharnier-naht"
          pathLength={BAHN}
          strokeDasharray={BAHN}
          strokeDashoffset={BAHN}
          d="M20 620 L20 760 Q20 900 50 900 Q80 900 80 760 L80 620"
        />
      </svg>

      <ol className="epochen-liste">
        {EPOCHEN.map((epoche, i) => (
          <li
            className="epoche"
            key={epoche.marke}
            data-station
            data-phase={epoche.phase}
            data-zweig={zweig[i]}
            data-auftritt={`epoche-${epoche.marke}`}
          >
            <p className="epoche-marke verborgen" data-rolle="marginalie">{epoche.marke}</p>
            <h3 className="epoche-ort verborgen" data-rolle="schlagzeile">{epoche.ort}</h3>
            <p className="epoche-satz verborgen" data-rolle="zeile">{epoche.satz}</p>
          </li>
        ))}
      </ol>

      {/*
        SOLVE ET COAGULA steht am Fuß, dort wo die Naht sich schließt — nicht
        als Überschrift oben. Der Satz ist die Auflösung des Abschnitts, und
        eine Auflösung, die vorne steht, ist keine.
      */}
      <p className="scharnier-satz" data-station data-auftritt="scharnier-satz">
        <span className="verborgen" data-rolle="zeile">{SCHARNIER.solve}</span>{" "}
        <span className="scharnier-et verborgen" data-rolle="zeile">{SCHARNIER.et}</span>{" "}
        <span className="verborgen" data-rolle="zeile">{SCHARNIER.coagula}</span>
      </p>
    </section>
  );
}
