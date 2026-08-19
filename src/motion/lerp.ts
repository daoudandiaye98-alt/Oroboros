/**
 * Das Nachziehen — und die eine Rollschleife des Werks.
 *
 * Ein Nachzieher fragt einen Zielwert ab und schiebt einen eigenen Wert in
 * jedem Bild ein Stück darauf zu. Das ist die ganze Mathematik. Interessant
 * sind die drei Zusagen drumherum:
 *
 * 1. EINE EINZIGE Bildschleife für ALLE Nachzieher. Nicht eine je Aufruf. Fünf
 *    `requestAnimationFrame`-Schleifen nebeneinander sind fünfmal der
 *    Verwaltungsaufwand und laufen in unbestimmter Reihenfolge — dann zieht
 *    der Punkt dem Cursor nach, während der Cursor selbst schon eine Bild
 *    weiter ist.
 * 2. ZEITNORMALISIERT. Ein Faktor „0.077 pro Bild" bedeutet bei 120 Hz doppelt
 *    so schnell wie bei 60 Hz. Auf einem neuen Telefon liefe dieselbe Seite
 *    also anders als auf dem Schreibtischrechner, und niemand könnte sagen,
 *    welche der beiden die richtige ist. Gerechnet wird deshalb gegen die
 *    verstrichene Zeit.
 * 3. SIE SCHLÄFT EIN. Steht alles still, hört die Schleife auf. Eine Seite, die
 *    im Leerlauf sechzig Mal je Sekunde rechnet, kostet Akku für nichts.
 *
 * Lenis wird hier angelegt und exportiert — genau eine Rollinstanz im ganzen
 * Projekt, und sie hängt an derselben Schleife.
 */
import Lenis from "lenis";
import { tokens } from "./tokens";

interface Nachzieher {
  ziel: () => number;
  anwenden: (wert: number) => void;
  faktor: number;
  wert: number;
  /** Beim ersten Bild wird auf das Ziel gesprungen statt hingezogen. */
  frisch: boolean;
  wach: boolean;
}

const nachzieher = new Set<Nachzieher>();

/** Unter dieser Differenz gilt ein Nachzieher als angekommen. */
const RUHE_SCHWELLE = 0.001;

/** Der Bezugstakt, gegen den der Faktor definiert ist: 60 Bilder je Sekunde. */
const TAKT = 60;

let bild: number | null = null;
let letzteZeit = 0;

/* ————————————————————————————— Lenis ————————————————————————————— */

/**
 * Die eine Rollinstanz.
 *
 * `autoRaf: false` ist der Punkt: Lenis brächte sonst seine EIGENE Bildschleife
 * mit, und Zusage 1 wäre schon beim Import gebrochen. Es hängt stattdessen mit
 * an dieser hier.
 */
export const lenis: Lenis | null = typeof window === "undefined"
  ? null
  : new Lenis({ autoRaf: false });

/* ———————————————————————————— Die Schleife ———————————————————————————— */

/**
 * Die Ereignisse, nach denen sich ein Ziel geändert haben KANN.
 *
 * Eine schlafende Schleife kann nicht bemerken, dass sich ein Ziel bewegt hat —
 * dafür müsste sie laufen. Aber ein Ziel ändert sich nicht von selbst: dahinter
 * steht immer eine Eingabe. Auf genau die wird gehört, solange die Schleife
 * schläft; das erste Ereignis weckt sie und die Zuhörer werden wieder
 * abgemeldet. So kostet der Schlaf nichts und ist trotzdem keiner, aus dem
 * man nicht mehr aufwacht.
 */
const WECKER = [
  "pointermove", "pointerdown", "wheel", "touchstart", "touchmove",
  "keydown", "scroll", "resize",
] as const;

function weckerAn() {
  for (const name of WECKER) {
    window.addEventListener(name, wecken, { passive: true });
  }
}

function weckerAus() {
  for (const name of WECKER) {
    window.removeEventListener(name, wecken);
  }
}

function schritt(zeit: number) {
  const dt = letzteZeit === 0 ? 1 / TAKT : Math.min((zeit - letzteZeit) / 1000, 0.1);
  letzteZeit = zeit;

  lenis?.raf(zeit);

  let etwasWach = false;

  for (const n of nachzieher) {
    const ziel = n.ziel();
    if (!Number.isFinite(ziel)) continue;

    if (n.frisch) {
      n.frisch = false;
      n.wert = ziel;
      n.anwenden(n.wert);
      continue;
    }

    const rest = ziel - n.wert;
    if (Math.abs(rest) < RUHE_SCHWELLE) {
      if (n.wach) {
        // Sauber ankommen, dann schlafen: sonst bleibt ein Rest von 0,0009 px
        // für immer stehen, und ein Punkt, der „fast" beim Cursor ist, sieht
        // aus wie ein Fehler.
        n.wert = ziel;
        n.anwenden(n.wert);
        n.wach = false;
      }
      continue;
    }

    /*
     * Der zeitnormalisierte Schritt.
     *
     * `faktor` ist der Anteil, um den sich der Wert in EINEM Bild bei 60 Hz
     * dem Ziel nähert. Über `dt` Sekunden sind das `dt * 60` solche Bilder,
     * und weil jedes Bild denselben ANTEIL nimmt, multiplizieren sich die
     * Reste: `(1 - faktor)^(dt * 60)` bleibt übrig. Bei genau 60 Hz kommt
     * exakt `faktor` heraus — die alte Formel ist der Sonderfall dieser.
     */
    const anteil = 1 - Math.pow(1 - n.faktor, dt * TAKT);
    n.wert += rest * anteil;
    n.anwenden(n.wert);
    n.wach = true;
    etwasWach = true;
  }

  // Lenis rollt womöglich noch aus, auch wenn kein Nachzieher wach ist.
  if (etwasWach || lenis?.isScrolling) {
    bild = requestAnimationFrame(schritt);
    return;
  }

  bild = null;
  letzteZeit = 0;
  weckerAn();
}

/** Weckt die Schleife, falls sie schläft. */
export function wecken(): void {
  if (bild !== null) return;
  weckerAus();
  letzteZeit = 0;
  bild = requestAnimationFrame(schritt);
}

/* ————————————————————————— Die Schnittstelle ————————————————————————— */

/**
 * Zieht `anwenden` dem Wert von `ziel` nach.
 *
 * @param ziel     wird in jedem Bild gefragt — muss billig sein.
 * @param anwenden bekommt den nachgezogenen Wert.
 * @param faktor   Anteil je Bild bei 60 Hz; Standard ist `--lerp` aus dem
 *                 Stylesheet. Er wird beim Anmelden EINMAL gelesen — ein
 *                 Token-Zugriff in der Bildschleife wäre ein `getComputedStyle`
 *                 je Bild und je Nachzieher.
 * @returns        `stop()`. Wer ihn nicht aufruft, hinterlässt einen
 *                 Nachzieher, der die Schleife wachhält, obwohl sein Element
 *                 längst weg ist.
 */
export function nachziehen(
  ziel: () => number,
  anwenden: (wert: number) => void,
  faktor?: number,
): () => void {
  const n: Nachzieher = {
    ziel,
    anwenden,
    faktor: faktor ?? tokens().lerp,
    wert: 0,
    frisch: true,
    wach: true,
  };
  nachzieher.add(n);
  wecken();
  return () => {
    nachzieher.delete(n);
  };
}

/**
 * Hält die Schleife an und meldet alles ab — beim Verlassen der Anwendung.
 *
 * Lenis wird dabei NICHT zerstört: es ist die eine Rollinstanz der Seite und
 * überlebt jeden Routenwechsel. Zerstörte man sie hier, rollte die nächste
 * Route hart.
 */
export function lerpAufraeumen(): void {
  nachzieher.clear();
  if (bild !== null) cancelAnimationFrame(bild);
  bild = null;
  letzteZeit = 0;
  weckerAus();
}
