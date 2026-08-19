/**
 * Die Landing — eine Seite, eine durchlaufende Bewegung.
 *
 * Drei gepinnte Bühnen hintereinander, dazwischen kein Schnitt: eine
 * Wüstenotter zieht durch die Düne, rollt sich ein und wird zum Ouroboros.
 * Vollständig scroll-gebunden — es gibt auf dieser Seite keine einzige
 * Zeitachse, die von selbst läuft, außer dem Auftritt von Akt I.
 *
 * LADEREIHENFOLGE. Akt I wird vollständig geladen, bevor irgendetwas zu sehen
 * ist. Erst wenn er steht, beginnt Akt II zu laden, und erst danach Akt III.
 * Alle drei gleichzeitig anzufordern hieße, den Ladeschirm um die Bandbreite
 * zu bringen, die er gerade braucht — 183 Bilder, die um dieselbe Leitung
 * konkurrieren, sind langsamer als 61, dann 61, dann 61.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ladeSequenz, type Sequenz } from "../motion/sequenz";
import { ruhig as istRuhig } from "../motion/tokens";
import { choreografie, FRAMES, type Satz } from "./choreografie";
import { AktKopf } from "./AktKopf";
import { AktWeg } from "./AktWeg";
import { AktKreis } from "./AktKreis";
import { Fortschrittsring, UMFANG } from "./Fortschrittsring";
import { Ladeschirm } from "./Ladeschirm";
import { Abspann } from "./Abspann";
import "../styles/landing.css";

/**
 * Hoch oder quer — einmal beim Laden entschieden.
 *
 * Kein Nachladen beim Drehen: den zweiten Satz mitten in der Sitzung zu holen
 * hieße, 61 Bilder anzufordern, während der Nutzer gerade schaut. Der bereits
 * geladene Satz läuft per `cover` weiter — das schneidet, aber es stockt
 * nicht, und Stocken ist der schlimmere Fehler.
 */
function satzWaehlen(): Satz {
  return window.matchMedia("(orientation: portrait)").matches ? "p" : "l";
}

export default function Landing() {
  const [satz] = useState<Satz>(satzWaehlen);
  const [ruhig] = useState<boolean>(istRuhig);
  const [anteil, setAnteil] = useState(0);
  const [frei, setFrei] = useState(false);
  const [auf, setAuf] = useState(false);

  const [kopfSeq, setKopfSeq] = useState<Sequenz | null>(null);
  const [wegSeq, setWegSeq] = useState<Sequenz | null>(null);
  const [kreisSeq, setKreisSeq] = useState<Sequenz | null>(null);

  const lauf = useRef<SVGCircleElement>(null);
  const schrift = useRef<HTMLSpanElement>(null);
  const stand = useRef<[number, number, number]>([0, 0, 0]);

  /* ————————————————————————— Laden ————————————————————————— */

  useEffect(() => {
    // Im Ruhemodus gibt es keine Sequenz und damit nichts zu laden. Ein
    // Ladeschirm für Standbilder wäre eine Wartezeit ohne Gegenwert.
    if (ruhig) { setFrei(true); setAuf(true); return; }

    const kopf = ladeSequenz(`head-${satz}`, FRAMES, {
      beiFortschritt: setAnteil,
      beiFertig: () => {
        setKopfSeq(kopf);
        setFrei(true);
        // Akt II, sobald Akt I steht. Akt III, sobald Akt II steht.
        const weg = ladeSequenz(`trav-${satz}`, FRAMES, {
          beiFertig: () => {
            setWegSeq(weg);
            const kreis = ladeSequenz(`coil-${satz}`, FRAMES, {
              beiFertig: () => setKreisSeq(kreis),
            });
          },
        });
      },
    });
  }, [satz, ruhig]);

  /** Der Auftritt von Akt I zündet erst, wenn der Ladeschirm weg ist. */
  useEffect(() => {
    if (!frei || auf) return;
    const id = requestAnimationFrame(() => setAuf(true));
    return () => cancelAnimationFrame(id);
  }, [frei, auf]);

  /* ————————————————————— Der Fortschrittsring ————————————————————— */

  const ringSchreiben = useCallback(() => {
    const g = choreografie().ring;
    const [a, b, c] = stand.current;
    const gesamt = Math.min(1, a * g[0] + b * g[1] + c * g[2]);
    if (lauf.current) {
      lauf.current.style.strokeDashoffset = String(UMFANG * (1 - gesamt));
    }
    if (schrift.current) {
      const zeichen = c > 0 ? "III" : b > 0 ? "II" : "I";
      if (schrift.current.textContent !== zeichen) schrift.current.textContent = zeichen;
    }
  }, []);

  const p1 = useCallback((p: number) => { stand.current[0] = p; ringSchreiben(); }, [ringSchreiben]);
  const p2 = useCallback((p: number) => { stand.current[1] = p; ringSchreiben(); }, [ringSchreiben]);
  const p3 = useCallback((p: number) => { stand.current[2] = p; ringSchreiben(); }, [ringSchreiben]);

  /** Der Knopf in Akt I führt zur nächsten Bühne — kein zweiter Ort, nur weiter. */
  const weiter = useCallback(() => {
    document.getElementById("akt-weg")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  /*
   * Im Ruhemodus steht der Ring auf voll.
   *
   * Ohne Bühnenbeobachtung meldet niemand einen Fortschritt, und ein Ring, der
   * dauerhaft leer bleibt, wäre eine Falschaussage über eine Seite, deren
   * ganzer Inhalt bereits sichtbar ist.
   */
  useEffect(() => {
    if (!ruhig) return;
    stand.current = [1, 1, 1];
    ringSchreiben();
  }, [ruhig, ringSchreiben]);

  return (
    <div className="landing-seite">
      {!ruhig && <Ladeschirm anteil={anteil} fertig={frei} />}
      <Fortschrittsring laufRef={lauf} schriftRef={schrift} />

      <main>
        <AktKopf seq={kopfSeq} auf={auf} ruhig={ruhig} aufFortschritt={p1} weiter={weiter} />
        <AktWeg seq={wegSeq} ruhig={ruhig} aufFortschritt={p2} />
        <AktKreis seq={kreisSeq} ruhig={ruhig} aufFortschritt={p3} />
      </main>

      <Abspann />
    </div>
  );
}
