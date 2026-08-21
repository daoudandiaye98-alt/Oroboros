/**
 * Die Token-Brücke: von `src/styles/bewegung.css` nach TypeScript.
 *
 * KEIN GSAP HIER. Die Kurven stehen in `kurven.ts`, weil nur sie GSAP
 * brauchen — und weil sonst jede Seite, die bloß eine Dauer lesen will,
 * die ganze Bibliothek mitlädt. Gemessen an der Landing: sie animiert
 * nichts mit GSAP und trug es trotzdem mit, rund 70 kB gzip auf dem
 * kritischen Pfad einer Seite, die auf ihr erstes Bild wartet.
 *
 * Zusammen mit `kurven.ts` ist dies die einzige Stelle in TypeScript, die
 * eine Zeitangabe oder eine Kurve überhaupt zu Gesicht bekommt — und beide
 * erfinden keine, sie lesen sie. Jede Zahl kommt aus `getComputedStyle(document.documentElement)`. Wer
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

/** Die Versätze der Landing, in SEKUNDEN. */
export interface Versaetze {
  zeichen: number;
  karte: number;
}

/** Die beiden Nachzieh-Faktoren (Anteil je Bild bei 60 Hz). */
export interface Nachzug {
  /** Das weiche Rollen der Seite — Lenis. */
  seite: number;
  /** Der Fortschritt der gepinnten Bühnen. */
  scrub: number;
}

export interface Token {
  dauer: Dauern;
  staffel: Staffeln;
  versatz: Versaetze;
  nachzug: Nachzug;
  /** Der Abstand des Weg-Pfeils in px, in Ruhe und unter dem Zeiger. */
  weg: { ruhe: number; hover: number };
}

/* ————————————————————————————— Auslesen ————————————————————————————— */

export function rohwert(stil: CSSStyleDeclaration, name: string): string {
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
    versatz: {
      zeichen: sekunden(rohwert(stil, "--versatz-zeichen")),
      karte: sekunden(rohwert(stil, "--versatz-karte")),
    },
    nachzug: {
      seite: parseFloat(rohwert(stil, "--nachzug-seite")) || 0,
      scrub: parseFloat(rohwert(stil, "--nachzug-scrub")) || 0,
    },
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

/**
 * Eine einzelne Dauer aus dem Stylesheet, in Millisekunden.
 *
 * Für die Ladeszene: sie ist die einzige Stelle der Seite mit einer echten
 * Zeitachse, und ihre fünf Schläge stehen — wie jede andere Dauer auch — in
 * `bewegung.css`. Ohne diesen Zugang stünden dort Zahlen im TypeScript, und
 * das Gesetz aus Phase 0 hätte seine erste Ausnahme.
 *
 * Frisch gelesen bei jedem Aufruf, aus demselben Grund wie `tokens()`.
 */
export function dauer(name: string): number {
  return sekunden(rohwert(getComputedStyle(document.documentElement), name)) * 1000;
}
