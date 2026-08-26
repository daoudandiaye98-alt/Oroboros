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
 *   marginalie       y 14→0, Deckkraft 0→1          block · fein, führt um 55 ms
 *   kicker           y 14→0, Deckkraft 0→1          block · standard
 *   schlagzeile      wortweise, y 14→0, 0→1         block · standard, Staffel Wort
 *   zeile            zeichenweise, y 14→0, 0→1      block · standard, Staffel Zeichen
 *   karte            y 14→0, Deckkraft 0→1          block · standard, Staffel Karte
 *   bild             Deckkraft 0→1, Maßstab 1.06→1  szene · dramatisch
 *
 * DIE MARGINALIE IST DIE EINZIGE ROLLE, DIE NICHT ANGEHÄNGT WIRD. Alle
 * anderen Gruppen laufen nacheinander an — die Marginalie führt, und die
 * Gruppe danach beginnt `--versatz-zeichen` nach ihr, nicht nach ihrem Ende.
 * Angehängt stünde die Jahreszahl eine volle Blockdauer allein auf dem
 * Schirm, bevor der Ort erscheint: zwei Auftritte statt eines.
 *
 * IntersectionObserver, NICHT ScrollTrigger. Ein Auftritt ist ein Ereignis
 * („jetzt ist es zu sehen"), keine Bewegung am Rollbalken. ScrollTrigger dafür
 * zu nehmen hieße, für jeden Absatz einen Rechenweg aufzuspannen, der bei
 * jedem Resize neu vermessen wird — und der bei `scrub` sogar rückwärts liefe.
 */
import { gsap } from "gsap";
import { AUFTRITT_ANTEIL, BILD_SKALA, WEG_Y, ruhig, tokens } from "./tokens";
import { kurven } from "./kurven";
import { zerlege } from "./split";

export type Rolle = "marginalie" | "kicker" | "schlagzeile" | "zeile" | "karte" | "bild";

const ROLLEN: readonly Rolle[] = ["marginalie", "kicker", "schlagzeile", "zeile", "karte", "bild"];

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
function gruppeSpielen(
  tl: gsap.core.Timeline,
  gruppe: Gruppe,
  still: boolean,
  stelle?: string,
): void {
  const t = tokens();
  const k = kurven();
  const { glieder, rolle } = gruppe;

  if (rolle === "marginalie") {
    /*
     * Die Marginalie — Jahreszahl, Ort, Kolumnenmarke.
     *
     * Dieselbe Bewegung wie ein Kicker, aber auf `--kurve-fein` statt
     * `--kurve-standard`: sie ist kurz, sie kommt zuerst, und eine Kurve, die
     * in der Mitte beschleunigt, sieht bei drei Wörtern nach nichts aus. Fein
     * läuft sofort los und schwingt aus — der Blick ist dann schon weiter.
     * Dies ist der erste Aufrufer von `--kurve-fein` überhaupt.
     */
    tl.fromTo(glieder,
      { opacity: 0, y: still ? 0 : WEG_Y },
      { opacity: 1, y: 0, duration: t.dauer.block, ease: k.fein, stagger: 0 }, stelle);
    return;
  }

  if (rolle === "bild") {
    tl.fromTo(glieder,
      { opacity: 0, scale: still ? 1 : BILD_SKALA },
      { opacity: 1, scale: 1, duration: t.dauer.szene, ease: k.dramatisch, stagger: 0 }, stelle);
    return;
  }

  if (rolle === "schlagzeile" || rolle === "zeile") {
    // Erst spalten, dann bewegen. Der Container selbst wird sofort sichtbar —
    // bewegt werden die Stücke, nicht ihre Hülle.
    const teile = glieder.flatMap((el) =>
      zerlege(el, rolle === "schlagzeile" ? "wort" : "zeichen"));
    tl.set(glieder, { opacity: 1 }, stelle);
    if (still) {
      // Nur Blende, und zwar an der Hülle: keine Translation, keine Staffelung.
      tl.fromTo(glieder, { opacity: 0 },
        { opacity: 1, duration: t.dauer.block, ease: k.standard, stagger: 0 }, "<");
      return;
    }
    if (teile.length === 0) return;
    /*
     * `"<"` UND NICHT `stelle` — und der Unterschied war ein Fehler.
     *
     * `stelle` ist relativ („Anfang der vorigen Bewegung plus Versatz"). Das
     * `tl.set` oben zählt als Bewegung, auch wenn es keine Dauer hat: die
     * zweite Angabe rechnete den Versatz deshalb ein zweites Mal auf. Der
     * Prüfstand hat es gefunden — 109 ± 5 ms gemessen bei erklärten 55, also
     * genau das Doppelte, reproduzierbar auf beiden Ansichten. Gerechnet
     * hätte es niemand nachgeprüft; die Bewegung sah plausibel aus.
     *
     * `"<"` heißt „am Anfang der vorigen Bewegung", also genau dort, wo das
     * `set` liegt — mit Versatz wie ohne.
     */
    tl.fromTo(teile,
      { opacity: 0, y: WEG_Y },
      {
        opacity: 1, y: 0, duration: t.dauer.block, ease: k.standard,
        stagger: rolle === "schlagzeile" ? t.staffel.wort : t.staffel.zeichen,
      }, "<");
    return;
  }

  // kicker und karte: dieselbe Bewegung, andere Staffelung.
  tl.fromTo(glieder,
    { opacity: 0, y: still ? 0 : WEG_Y },
    {
      opacity: 1, y: 0, duration: t.dauer.block, ease: k.standard,
      stagger: still ? 0 : (rolle === "karte" ? t.staffel.karte : 0),
    }, stelle);
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
  const alle = gruppen(container);
  for (let i = 0; i < alle.length; i++) {
    const gruppe = alle[i];
    if (!gruppe) continue;
    /*
     * Ohne Stelle wird angehängt — also nach dem ENDE der vorigen Gruppe. Das
     * ist die Regel und bleibt sie.
     *
     * Die eine Ausnahme steht oben im Kopf: nach einer Marginalie wird
     * überlappt. `"<"` ist in GSAP der ANFANG der vorigen Bewegung, der
     * Zusatz der Versatz in Sekunden. Im Ruhemodus ist der Versatz 0 —
     * `--versatz-zeichen` wird dort auf 0 ms umgeschaltet, und die Zahl kommt
     * auch hier aus der CSS-Datei und nicht aus dieser Zeile.
     */
    const vorige = i > 0 ? alle[i - 1] : undefined;
    const stelle = vorige?.rolle === "marginalie"
      ? `<${still ? 0 : tokens().versatz.zeichen}`
      : undefined;
    gruppeSpielen(tl, gruppe, still, stelle);
  }
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
