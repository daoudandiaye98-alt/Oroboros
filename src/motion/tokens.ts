/**
 * Die Token-Brücke: von `src/styles/bewegung.css` nach GSAP.
 *
 * Diese Datei ist die einzige Stelle in TypeScript, die eine Zeitangabe oder
 * eine Kurve überhaupt zu Gesicht bekommt — und sie erfindet keine, sie liest
 * sie. Jede Zahl kommt aus `getComputedStyle(document.documentElement)`. Wer
 * eine Bewegung ändern will, ändert die CSS-Variable; hier ändert sich nichts.
 *
 * ZWEI GRÜNDE, WARUM ZUR LAUFZEIT GELESEN WIRD UND NICHT BEIM BAUEN:
 *
 * 1. `prefers-reduced-motion` schaltet die Token um. Ein zur Bauzeit
 *    eingefrorener Wert wüsste davon nichts — der Fallback wäre eine
 *    Behauptung, keine Messung.
 * 2. Der Schalter in `/werkstatt` setzt dieselbe Umschaltung über eine Klasse
 *    am `<html>`. Auch das sieht nur, wer im Moment der Bewegung nachliest.
 *
 * Deshalb gibt `tokens()` bei JEDEM Aufruf frisch gelesene Werte zurück und
 * hält nichts in einem Modul-Zwischenspeicher fest. Gelesen wird beim Start
 * einer Bewegung, nie in einer Bildschleife.
 */
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);

/** Die drei Kurven, wie GSAP sie versteht (Name einer registrierten CustomEase). */
export interface Kurven {
  standard: string;
  fein: string;
  dramatisch: string;
}

/** Alle Dauern in SEKUNDEN — die Einheit, in der GSAP rechnet. */
export interface Dauern {
  mikro: number;
  hover: number;
  block: number;
  szene: number;
}

/** Alle Staffelschritte in SEKUNDEN. */
export interface Staffeln {
  wort: number;
  zeichen: number;
  karte: number;
}

export interface Token {
  kurve: Kurven;
  dauer: Dauern;
  staffel: Staffeln;
  /** Der Nachzieh-Faktor pro Bild bei 60 Hz (dimensionslos). */
  lerp: number;
  /** Der Abstand des Weg-Pfeils in px, in Ruhe und unter dem Zeiger. */
  weg: { ruhe: number; hover: number };
}

/* ————————————————————————————— Auslesen ————————————————————————————— */

function rohwert(stil: CSSStyleDeclaration, name: string): string {
  return stil.getPropertyValue(name).trim();
}

/**
 * `700ms` oder `0.7s` → 0.7 (Sekunden).
 *
 * Eine Zeit ohne Einheit wäre ein Tippfehler in der CSS-Datei und keine Zahl,
 * die man raten sollte — sie ergibt hier 0, und eine Bewegung mit Dauer 0
 * fällt sofort auf. Stillschweigend „ms" anzunehmen würde denselben Tippfehler
 * verstecken.
 */
function sekunden(roh: string): number {
  const zahl = parseFloat(roh);
  if (!Number.isFinite(zahl)) return 0;
  if (roh.endsWith("ms")) return zahl / 1000;
  if (roh.endsWith("s")) return zahl;
  return 0;
}

/** `14px` → 14. */
function px(roh: string): number {
  const zahl = parseFloat(roh);
  return Number.isFinite(zahl) ? zahl : 0;
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

/**
 * Der aktuelle Stand der Token.
 *
 * Frisch gelesen bei jedem Aufruf — siehe Kopf der Datei. Ohne `document`
 * (Serverlauf, Test ohne DOM) gibt es keine Token; dann trägt der Aufrufer
 * die Verantwortung. Hier etwas zu erfinden hieße, zwei Bewegungssprachen zu
 * pflegen: eine im Stylesheet und eine im Notfallzweig.
 */
export function tokens(): Token {
  const stil = getComputedStyle(document.documentElement);
  return {
    kurve: {
      standard: kurveAus(rohwert(stil, "--kurve-standard"), "power2.inOut"),
      fein: kurveAus(rohwert(stil, "--kurve-fein"), "power2.out"),
      dramatisch: kurveAus(rohwert(stil, "--kurve-dramatisch"), "power4.inOut"),
    },
    dauer: {
      mikro: sekunden(rohwert(stil, "--dauer-mikro")),
      hover: sekunden(rohwert(stil, "--dauer-hover")),
      block: sekunden(rohwert(stil, "--dauer-block")),
      szene: sekunden(rohwert(stil, "--dauer-szene")),
    },
    staffel: {
      wort: sekunden(rohwert(stil, "--staffel-wort")),
      zeichen: sekunden(rohwert(stil, "--staffel-zeichen")),
      karte: sekunden(rohwert(stil, "--staffel-karte")),
    },
    lerp: parseFloat(rohwert(stil, "--lerp")) || 0,
    weg: {
      ruhe: px(rohwert(stil, "--weg-gap-ruhe")),
      hover: px(rohwert(stil, "--weg-gap-hover")),
    },
  };
}

/** Die Klasse, mit der `/werkstatt` die Systemeinstellung nachstellt. */
export const RUHIG_KLASSE = "ruhige-bewegung";

/**
 * Soll ruhig bewegt werden?
 *
 * Zwei Quellen, eine Antwort: die Systemeinstellung des Geräts UND der
 * Schalter aus `/werkstatt`. Der Schalter ist kein Spielzeug — ohne ihn ließe
 * sich der Fallback nur prüfen, indem man das Betriebssystem umstellt, und
 * damit prüft ihn in der Praxis niemand.
 */
export function ruhig(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.classList.contains(RUHIG_KLASSE)) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Die eine Verschiebung, mit der alles auftritt (px). Neverlands Maß. */
export const WEG_Y = 14;

/** Der Maßstab, aus dem ein Bild in seinen Platz fällt. */
export const BILD_SKALA = 1.06;

/** Anteil des Containers, der sichtbar sein muss, damit der Auftritt läuft. */
export const AUFTRITT_ANTEIL = 0.2;
