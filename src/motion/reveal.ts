/**
 * Das Auftritts-Gesetz.
 *
 * Ein Container tritt auf, sobald er zu 20 % im Sichtfeld steht. Was dann
 * passiert, steht NICHT im Aufrufer, sondern hier — und zwar für alle
 * Container gleich. Der Aufrufer sagt über `data-rolle` nur, WAS ein Kind
 * ist; WIE es sich bewegt, entscheidet diese Datei.
 *
 * Die Choreografie:
 *
 *   data-rolle       Bewegung                       Timing
 *   ───────────────────────────────────────────────────────────────────
 *   kicker           y 14→0, Deckkraft 0→1          block · standard
 *   schlagzeile      wortweise, y 14→0, 0→1         block · standard, Staffel Wort
 *   zeile            zeichenweise, y 14→0, 0→1      block · standard, Staffel Zeichen
 *   karte            y 14→0, Deckkraft 0→1          block · standard, Staffel Karte
 *   bild             Deckkraft 0→1, Maßstab 1.06→1  szene · dramatisch
 *
 * IntersectionObserver, NICHT ScrollTrigger. Ein Auftritt ist ein Ereignis
 * („jetzt ist es zu sehen"), keine Bewegung am Rollbalken. ScrollTrigger dafür
 * zu nehmen hieße, für jeden Absatz einen Rechenweg aufzuspannen, der bei
 * jedem Resize neu vermessen wird — und der bei `scrub` sogar rückwärts liefe.
 */
import { gsap } from "gsap";
import { AUFTRITT_ANTEIL, BILD_SKALA, WEG_Y, ruhig, tokens } from "./tokens";
import { zerlege } from "./split";

export type Rolle = "kicker" | "schlagzeile" | "zeile" | "karte" | "bild";

const ROLLEN: readonly Rolle[] = ["kicker", "schlagzeile", "zeile", "karte", "bild"];

export interface AuftrittOptionen {
  /**
   * Läuft der Auftritt nur einmal je Sitzung? Standard: ja.
   *
   * Gemerkt wird in `sessionStorage`, nicht in `localStorage`: beim nächsten
   * Besuch soll die Seite wieder auftreten. Innerhalb einer Sitzung nicht —
   * wer zweimal an derselben Stelle vorbeirollt, will keine zweite Vorstellung.
   */
  einmalig?: boolean;
}

const SPEICHER_PRAEFIX = "oroboros:auftritt:";

/** Alle laufenden Beobachter, damit ein Routenwechsel sie schließen kann. */
const beobachter = new Set<IntersectionObserver>();

/**
 * Ein Schlüssel, der denselben Container über einen Neuaufbau hinweg wiederfindet.
 *
 * Bevorzugt das, was der Aufrufer selbst gesetzt hat (`data-auftritt`, sonst
 * `id`). Ohne beides wird der Weg im DOM buchstabiert. Der ist stabil, solange
 * sich die Struktur nicht ändert — und ändert sie sich, ist ein erneuter
 * Auftritt das kleinere Übel als ein stummer Container.
 */
function schluessel(el: HTMLElement): string {
  if (el.dataset.auftritt) return el.dataset.auftritt;
  if (el.id) return el.id;
  const weg: string[] = [];
  for (let k: HTMLElement | null = el; k && k !== document.body; k = k.parentElement) {
    const eltern = k.parentElement;
    weg.unshift(eltern ? String(Array.prototype.indexOf.call(eltern.children, k)) : "0");
  }
  return weg.join("-");
}

function gelaufen(el: HTMLElement): boolean {
  try {
    return sessionStorage.getItem(SPEICHER_PRAEFIX + schluessel(el)) === "1";
  } catch {
    // Privater Modus, gesperrter Speicher: dann läuft der Auftritt eben wieder.
    return false;
  }
}

function merken(el: HTMLElement): void {
  try {
    sessionStorage.setItem(SPEICHER_PRAEFIX + schluessel(el), "1");
  } catch { /* siehe oben */ }
}

/** Vergisst alle gemerkten Auftritte — der Schalter in /werkstatt braucht das. */
export function auftritteVergessen(): void {
  try {
    for (const name of Object.keys(sessionStorage)) {
      if (name.startsWith(SPEICHER_PRAEFIX)) sessionStorage.removeItem(name);
    }
  } catch { /* siehe oben */ }
}

/* ————————————————————————— Die Choreografie ————————————————————————— */

interface Gruppe {
  rolle: Rolle;
  glieder: HTMLElement[];
}

/**
 * Die Kinder mit Rolle, in DOM-Reihenfolge, aufeinanderfolgende gleiche Rollen
 * zu einer Gruppe zusammengefasst.
 *
 * Das Zusammenfassen ist der ganze Trick hinter „Staffel Karte": vier Karten
 * sind EINE Bewegung mit vier Verzögerungen, nicht vier Bewegungen
 * hintereinander. Stünde jede Karte für sich, wäre die Staffelung tot und der
 * Block liefe viermal so lange.
 */
function gruppen(container: HTMLElement): Gruppe[] {
  const kinder = Array.from(container.querySelectorAll<HTMLElement>("[data-rolle]"))
    .filter((el) => ROLLEN.includes(el.dataset.rolle as Rolle));
  const raus: Gruppe[] = [];
  for (const el of kinder) {
    const rolle = el.dataset.rolle as Rolle;
    const letzte = raus[raus.length - 1];
    if (letzte && letzte.rolle === rolle) letzte.glieder.push(el);
    else raus.push({ rolle, glieder: [el] });
  }
  return raus;
}

/**
 * Die Choreografie einer Gruppe an die Zeitleiste hängen.
 *
 * Angehängt wird ohne Positionsangabe, also am ENDE der vorigen Gruppe: „die
 * Rollen laufen nacheinander an, nicht gleichzeitig". Innerhalb einer Gruppe
 * staffelt GSAP.
 */
function gruppeSpielen(tl: gsap.core.Timeline, gruppe: Gruppe, still: boolean): void {
  const t = tokens();
  const { glieder, rolle } = gruppe;

  if (rolle === "bild") {
    tl.fromTo(glieder,
      { opacity: 0, scale: still ? 1 : BILD_SKALA },
      { opacity: 1, scale: 1, duration: t.dauer.szene, ease: t.kurve.dramatisch, stagger: 0 });
    return;
  }

  if (rolle === "schlagzeile" || rolle === "zeile") {
    // Erst spalten, dann bewegen. Der Container selbst wird sofort sichtbar —
    // bewegt werden die Stücke, nicht ihre Hülle.
    const teile = glieder.flatMap((el) =>
      zerlege(el, rolle === "schlagzeile" ? "wort" : "zeichen"));
    tl.set(glieder, { opacity: 1 });
    if (still) {
      // Nur Blende, und zwar an der Hülle: keine Translation, keine Staffelung.
      tl.fromTo(glieder, { opacity: 0 },
        { opacity: 1, duration: t.dauer.block, ease: t.kurve.standard, stagger: 0 }, "<");
      return;
    }
    if (teile.length === 0) return;
    tl.fromTo(teile,
      { opacity: 0, y: WEG_Y },
      {
        opacity: 1, y: 0, duration: t.dauer.block, ease: t.kurve.standard,
        stagger: rolle === "schlagzeile" ? t.staffel.wort : t.staffel.zeichen,
      });
    return;
  }

  // kicker und karte: dieselbe Bewegung, andere Staffelung.
  tl.fromTo(glieder,
    { opacity: 0, y: still ? 0 : WEG_Y },
    {
      opacity: 1, y: 0, duration: t.dauer.block, ease: t.kurve.standard,
      stagger: still ? 0 : (rolle === "karte" ? t.staffel.karte : 0),
    });
}

/**
 * Lässt `container` auftreten, sobald er zu 20 % sichtbar ist.
 *
 * Alles startet unsichtbar — aber über die Klasse `.verborgen` IM MARKUP, nicht
 * durch einen Griff dieser Funktion. Das ist kein Stilfrage: setzte erst diese
 * Funktion die Deckkraft auf 0, blitzte der Text bei langsamer Verbindung
 * einmal auf. GSAPs Inline-Werte übersteuern die Klasse anschließend von
 * selbst, es muss also nichts abgeräumt werden.
 */
export function auftritt(container: HTMLElement, opts: AuftrittOptionen = {}): void {
  const einmalig = opts.einmalig ?? true;
  if (einmalig && gelaufen(container)) {
    // Schon gelaufen: der Endzustand wird gesetzt, nicht gespielt. Sonst bliebe
    // der Container für den Rest der Sitzung unsichtbar.
    endzustand(container);
    return;
  }

  const beobachtung = new IntersectionObserver((eintraege) => {
    for (const eintrag of eintraege) {
      if (!eintrag.isIntersecting) continue;
      beobachtung.disconnect();
      beobachter.delete(beobachtung);
      spielen(container);
      if (einmalig) merken(container);
    }
  }, { threshold: AUFTRITT_ANTEIL });

  beobachtung.observe(container);
  beobachter.add(beobachtung);
}

function spielen(container: HTMLElement): void {
  const still = ruhig();
  const tl = gsap.timeline();
  for (const gruppe of gruppen(container)) gruppeSpielen(tl, gruppe, still);
}

/**
 * Der Endzustand ohne Bewegung.
 *
 * Gebraucht, wenn der Auftritt in dieser Sitzung schon gelaufen ist. Gesetzt
 * wird dasselbe, was die Zeitleiste am Ende stehen lässt — sonst hinge das
 * Ergebnis davon ab, ob jemand die Seite zum ersten oder zweiten Mal sieht.
 */
export function endzustand(container: HTMLElement): void {
  for (const gruppe of gruppen(container)) {
    if (gruppe.rolle === "schlagzeile" || gruppe.rolle === "zeile") {
      const teile = gruppe.glieder.flatMap((el) =>
        zerlege(el, gruppe.rolle === "schlagzeile" ? "wort" : "zeichen"));
      gsap.set(gruppe.glieder, { opacity: 1 });
      if (teile.length > 0) gsap.set(teile, { opacity: 1, y: 0 });
      continue;
    }
    gsap.set(gruppe.glieder, { opacity: 1, y: 0, scale: 1 });
  }
}

/** Schließt alle offenen Beobachter — beim Routenwechsel aufzurufen. */
export function auftritteAufraeumen(): void {
  for (const b of beobachter) b.disconnect();
  beobachter.clear();
}
