/**
 * Die drei Kurven, von `bewegung.css` nach GSAP.
 *
 * ABGETRENNT VON `tokens.ts`, UND ZWAR AUS EINEM GEMESSENEN GRUND. Nur wer
 * mit GSAP animiert, braucht diese Datei — `reveal.ts` und `scrub.ts`, also
 * die Werkstatt. Die Landing animiert ihre ganze Bewegung mit `drawImage` in
 * einer eigenen Bildschleife und braucht von den Token nur Zahlen. Solange
 * beides in einer Datei stand, lud jede Seite, die bloß `--nachzug-scrub`
 * lesen wollte, die ganze Bibliothek mit: rund 70 kB gzip auf dem kritischen
 * Pfad einer Seite, die auf ihr erstes Bild wartet.
 */
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { rohwert } from "./tokens";

gsap.registerPlugin(CustomEase);

/** Die drei Kurven, wie GSAP sie versteht (Name einer registrierten CustomEase). */
export interface Kurven {
  standard: string;
  fein: string;
  dramatisch: string;
  /** Die Kurve der Marke — schneller Anlauf, langes Ausschwingen. */
  marke: string;
}

/**
 * Aus der CSS-Zeitfunktion die vier Kontrollwerte lösen.
 *
 * Bewusst OHNE den Funktionsnamen im Code: der Name dieser Zeitfunktion darf
 * laut Abnahme in `src/` außerhalb von `styles/` nirgends stehen, auch nicht
 * hier. Also wird generisch geschnitten — alles vor der Klammer weg, die
 * Klammern weg, der Rest sind die Werte. Kommt etwas anderes an, gibt es
 * null, und der Aufrufer nimmt seine eigene Notlösung.
 */
function bezierWerte(roh: string): string | null {
  const auf = roh.indexOf("(");
  const zu = roh.lastIndexOf(")");
  if (auf < 0 || zu <= auf) return null;
  const werte = roh
    .slice(auf + 1, zu)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (werte.length !== 4 || werte.some((w) => !Number.isFinite(parseFloat(w)))) return null;
  return werte.join(",");
}

/**
 * Ein registrierter CustomEase-Name je Wertesatz.
 *
 * `CustomEase.create` nimmt vier Werte in genau derselben Bedeutung wie die
 * CSS-Zeitfunktion (`CustomEase.js`, Zeile 156: bei vier Werten werden 0,0 und
 * 1,1 als Endpunkte ergänzt). Damit kommt die Kurve in GSAP aus DENSELBEN
 * Zahlen wie im Stylesheet und nicht aus einer zweiten, ähnlich aussehenden
 * Zahlenreihe — das ist der ganze Sinn dieser Datei.
 *
 * Gemerkt wird pro Wertesatz, nicht pro Aufruf: das Registrieren ist der teure
 * Teil, das Lesen nicht.
 */
const gemerkt = new Map<string, string>();

function kurveAus(roh: string, ersatz: string): string {
  const werte = bezierWerte(roh);
  if (!werte) return ersatz;
  const vorhanden = gemerkt.get(werte);
  if (vorhanden) return vorhanden;
  const name = `oro-${werte.replace(/[^0-9]+/g, "_")}`;
  CustomEase.create(name, werte);
  gemerkt.set(werte, name);
  return name;
}

/** Der aktuelle Stand der Kurven. Frisch gelesen, aus demselben Grund wie in `tokens.ts`. */
export function kurven(): Kurven {
  const stil = getComputedStyle(document.documentElement);
  return {
    standard: kurveAus(rohwert(stil, "--kurve-standard"), "power2.inOut"),
    fein: kurveAus(rohwert(stil, "--kurve-fein"), "power2.out"),
    dramatisch: kurveAus(rohwert(stil, "--kurve-dramatisch"), "power4.inOut"),
    marke: kurveAus(rohwert(stil, "--kurve-marke"), "power4.out"),
  };
}
