/**
 * Bewegung hängt am Scroll, nicht an der Uhr.
 *
 * Das ist Neverlands Kernprinzip und der Grund, warum diese Datei so schmal
 * ist wie sie streng ist: eine gescrubbte Bewegung bekommt IMMER `ease: "none"`.
 * Die Kurve entsteht aus der Hand des Nutzers — aus dem Tempo, mit dem er
 * rollt. Legt der Code eine zweite Kurve darüber, kämpfen zwei Kurven um
 * dieselbe Bewegung, und das Ergebnis fühlt sich klebrig an, ohne dass man
 * benennen könnte, warum. Wer trotzdem eine übergibt, bekommt im Dev-Modus
 * einen Konsolen-Fehler und seine Kurve wird verworfen.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ruhig } from "./tokens";

gsap.registerPlugin(ScrollTrigger);

export interface ScrubOptionen {
  /** Hält den Auslöser das Element fest, während die Bewegung läuft? */
  pin?: boolean;
  /**
   * `true` — die Bewegung klebt am Rollbalken, Bild für Bild.
   * Eine Zahl — sie läuft um so viele Sekunden nach. Nur für weiches
   * Nachlaufen; 0.5 ist der einzige Wert, für den es hier einen Anlass gibt.
   */
  scrub?: number | true;
}

/** Alle von hier erzeugten Auslöser, damit ein Routenwechsel sie killen kann. */
const auslöser = new Set<ScrollTrigger>();

/**
 * Ein Resize verschiebt jede Rechenstrecke — ohne `refresh()` misst der
 * Auslöser danach gegen Maße von vorhin. Ein einziger Zuhörer für alle
 * Auslöser, angemeldet beim ersten `scrubbe`, abgemeldet beim Aufräumen.
 */
let zuhoertBereits = false;

function beiGroessenwechsel() {
  ScrollTrigger.refresh();
}

function zuhoeren() {
  if (zuhoertBereits) return;
  window.addEventListener("resize", beiGroessenwechsel);
  window.addEventListener("orientationchange", beiGroessenwechsel);
  zuhoertBereits = true;
}

/**
 * Hängt eine Bewegung an den Rollbalken.
 *
 * Rückgabe ist `ScrollTrigger | null` und nicht `ScrollTrigger`: bei
 * `prefers-reduced-motion` wird gar kein Auslöser erzeugt (siehe unten), und
 * einen leeren zurückzugeben, nur damit der Typ stimmt, wäre eine Lüge mit
 * Aufräumkosten. Der Aufrufer prüft auf `null` — das ist genau die Stelle, an
 * der er ohnehin wissen muss, dass hier nichts läuft.
 */
export function scrubbe(
  el: HTMLElement,
  von: gsap.TweenVars,
  nach: gsap.TweenVars,
  opts: ScrubOptionen = {},
): ScrollTrigger | null {
  /*
   * Bei „Bewegung reduzieren" wird der Auslöser NICHT erzeugt — nicht bloß
   * beschleunigt. Ein gescrubbter Auslöser hat keine Dauer, die man kürzen
   * könnte; seine Bewegung IST das Rollen. Übrig bliebe also dieselbe
   * Bewegung, nur mit demselben Rechenaufwand. Stattdessen wird der Endzustand
   * gesetzt: was die Bewegung zeigen wollte, ist damit zu sehen, ohne dass sich
   * etwas bewegt hat.
   */
  if (ruhig()) {
    gsap.set(el, { ...nach, ease: undefined });
    return null;
  }

  if ("ease" in nach || "ease" in von) {
    if (import.meta.env.DEV) {
      console.error(
        "[scrubbe] Eine Kurve wurde übergeben und wird verworfen. Eine gescrubbte "
        + "Bewegung läuft immer linear — die Kurve entsteht aus der Hand des "
        + "Nutzers, nicht aus dem Code. Betroffenes Element:", el,
      );
    }
  }

  zuhoeren();

  /*
   * WAS `pin: true` FESTHÄLT — UND WARUM NICHT `el`.
   *
   * Ein gepinntes Element kann sich nicht zugleich bewegen: ScrollTrigger
   * übernimmt beim Pinnen seine Positionierung vollständig (es setzt `position`
   * und `inset` am Element und hängt einen Abstandhalter davor). Eine parallel
   * laufende Transformation wird dabei überschrieben. Gemessen an /werkstatt:
   * `pin: el` erzeugte den Abstandhalter korrekt, ließ das Element aber über
   * die gesamte Strecke bei `transform: none` stehen — die Bewegung fand
   * schlicht nicht statt, und nichts sagte es.
   *
   * Festgehalten wird deshalb die BÜHNE: das nächste `[data-buehne]` darüber,
   * ersatzweise das Elternelement. Sie steht still, das Element wandert darin.
   * Sie ist dann auch der Auslöser — die Strecke muss an dem gemessen werden,
   * was hängt, nicht an dem, was sich bewegt.
   */
  const buehne = el.closest<HTMLElement>("[data-buehne]") ?? el.parentElement ?? el;

  const tween = gsap.fromTo(el,
    { ...von, ease: undefined },
    {
      ...nach,
      // Erzwungen, nach dem Ausbreiten von `nach`: eine übergebene Kurve kann
      // hier nicht mehr durchrutschen.
      ease: "none",
      scrollTrigger: opts.pin
        ? {
            trigger: buehne,
            pin: buehne,
            // Beim Pinnen steht der Anfang oben — sonst begänne die Bewegung,
            // bevor die Bühne festhängt. Die Strecke ist ein Bildschirm hoch:
            // „über 100 vh wandern" ist genau das.
            start: "top top",
            end: () => `+=${window.innerHeight}`,
            scrub: opts.scrub ?? true,
          }
        : {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: opts.scrub ?? true,
          },
    });

  const ausloeser = (tween.scrollTrigger ?? null) as ScrollTrigger | null;
  if (ausloeser) auslöser.add(ausloeser);
  return ausloeser;
}

/**
 * Killt alle hier erzeugten Auslöser und meldet den Resize-Zuhörer ab.
 *
 * Ohne diesen Aufruf bleibt bei jedem Routenwechsel ein Auslöser samt Pin-
 * Abstandhalter im DOM zurück. Nach fünf Wechseln misst ScrollTrigger gegen
 * fünf Strecken, von denen vier zu Elementen gehören, die es nicht mehr gibt.
 */
export function scrubAufraeumen(): void {
  for (const a of auslöser) a.kill(true);
  auslöser.clear();
  if (zuhoertBereits) {
    window.removeEventListener("resize", beiGroessenwechsel);
    window.removeEventListener("orientationchange", beiGroessenwechsel);
    zuhoertBereits = false;
  }
}
