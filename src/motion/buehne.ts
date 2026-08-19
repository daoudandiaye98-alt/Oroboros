/**
 * Die gepinnte Bühne — Scrollposition als Fortschritt von 0 bis 1.
 *
 * Eine Bühne ist ein hoher Kasten, in dem ein `position: sticky`-Kind einen
 * Bildschirm hoch stehen bleibt. Solange der Kasten durchläuft, steht das Bild
 * still und sein INHALT bewegt sich — genau das ist scroll-gebundene
 * Choreografie.
 *
 *     p = -rect.top / (offsetHeight - innerHeight)
 *
 * `rect.top` ist negativ, sobald der Kasten oben aus dem Bild läuft; der
 * Nenner ist der Weg, den er zurücklegt, bevor sein unteres Ende erreicht ist.
 *
 * KEINE SCROLL-BIBLIOTHEK. `getBoundingClientRect` in einer Bildschleife ist
 * hier das ehrlichere Werkzeug: ScrollTrigger würde für dieselbe Zahl eine
 * Strecke vorausberechnen, die bei jedem Resize, jedem Bildwechsel und jeder
 * Adressleiste des Telefons neu vermessen werden müsste. Der Rechteckabruf
 * fragt stattdessen jedes Bild neu — er kann per Bauart nicht veralten.
 */
import { nachziehen } from "./lerp";
import { tokens } from "./tokens";

/** Fortschritt eines Bühnenkastens, geklemmt auf 0…1. */
export function fortschritt(kasten: HTMLElement): number {
  const rect = kasten.getBoundingClientRect();
  const weg = kasten.offsetHeight - window.innerHeight;
  if (weg <= 0) return 0;
  return Math.max(0, Math.min(1, -rect.top / weg));
}

/**
 * Hängt einen geglätteten Fortschritt an einen Bühnenkasten.
 *
 * Geglättet wird mit `--nachzug-scrub` über die gemeinsame Bildschleife aus
 * `lerp.ts` — es gibt im ganzen Projekt genau eine, und sie schläft ein, wenn
 * nichts mehr nachzieht.
 *
 * @returns `stop()`. Ohne den Aufruf hält der Nachzieher die Schleife wach,
 *          auch wenn die Bühne längst aus dem DOM ist.
 */
export function buehneBeobachten(
  kasten: HTMLElement,
  anwenden: (p: number) => void,
): () => void {
  return nachziehen(() => fortschritt(kasten), anwenden, tokens().nachzug.scrub);
}

/**
 * Ein Ausschnitt aus dem Fortschritt, auf 0…1 gedehnt.
 *
 * `bereich(p, 0.52, 0.78)` heißt: vor 0.52 noch nichts, nach 0.78 fertig,
 * dazwischen linear. Damit werden Fenster beschrieben, ohne dass irgendwo eine
 * Bedingung mit zwei Zahlen im Komponentencode steht.
 */
export function bereich(p: number, von: number, bis: number): number {
  if (bis <= von) return p >= bis ? 1 : 0;
  return Math.max(0, Math.min(1, (p - von) / (bis - von)));
}
