/**
 * Die fünf Epochen — Inhalt, getrennt vom Bau.
 *
 * Der Release sagt zu Abschnitt 04: *„Die fünf Epochen des Ouroboros als
 * struktureller Rücken, SOLVE ET COAGULA als Brücke zwischen Trennen und
 * Binden."* Mehr sagt er nicht, und mehr wird hier nicht erfunden.
 *
 * **Kein Bild.** Der Release führt den Abschnitt als ERZEUGEN mit dem
 * Vermerk „Kein Material im Tresor". Ein Platzhalterbild wäre die Lüge, die
 * die Native Pipeline verbietet — also steht jede Station als Typografie und
 * Linie. Wo ein Motiv fehlt, fehlt es sichtbar.
 *
 * Jeder Text ≤ 40 Wörter. Nicht als Stilregel, sondern weil dieser Abschnitt
 * einen Rücken bildet und keine Abhandlung: wer hier liest, soll den Bogen
 * sehen, nicht den Beleg.
 */

export interface Epoche {
  /** Die Jahrhundertmarke in der Marginalie. Versalien, knapp. */
  marke: string;
  ort: string;
  /** ≤ 40 Wörter. */
  satz: string;
  /**
   * Trennen oder Binden — die beiden Hälften von SOLVE ET COAGULA.
   *
   * Sie steuert nicht die Gestaltung, sie **ist** die Struktur: die Linie
   * teilt sich, solange getrennt wird, und schließt sich, sobald gebunden
   * wird. Ohne dieses Feld wäre das Scharnier eine Behauptung im Text.
   */
  phase: "solve" | "coagula";
}

export const EPOCHEN: readonly Epoche[] = [
  {
    marke: "XIV. JH. V. CHR.",
    ort: "Ägypten",
    satz:
      "Im Grab des Tutanchamun umschließt eine Schlange, die sich in den Schwanz beißt, " +
      "den Kopf des Königs und seine Füße. Das älteste bekannte Bild. Noch kein Begriff — " +
      "eine Form, die sagt, dass etwas ohne Anfang weitergeht.",
    phase: "solve",
  },
  {
    marke: "II. JH.",
    ort: "Alexandria",
    satz:
      "Die Alchemisten geben ihm einen Satz: ἓν τὸ πᾶν — eines ist alles. Auf dem " +
      "Papyrus der Chrysopoeia liegt der Ring um die Worte. Aus dem Bild wird ein " +
      "Gedanke, den man aufschreiben kann.",
    phase: "solve",
  },
  {
    marke: "III. JH.",
    ort: "Die Gnosis",
    satz:
      "Das Zeichen wird Lehre. Die Welt zerfällt und setzt sich zusammen, und dazwischen " +
      "liegt nichts als derselbe Vorgang. Wer trennt, ohne zu binden, hat nur zerstört. " +
      "SOLVE ET COAGULA.",
    phase: "solve",
  },
  {
    marke: "1865",
    ort: "Kekulé",
    satz:
      "Ein Chemiker träumt von einer Schlange, die sich in den Schwanz beißt, und wacht " +
      "mit dem Benzolring auf. Das älteste Zeichen der Menschheit wird zur Struktur eines " +
      "Moleküls. Es hat nichts erklärt — es hat jemanden sehen lassen.",
    phase: "coagula",
  },
  {
    marke: "HEUTE",
    ort: "Das Studio",
    satz:
      "Wir bauen keine Seiten, die von Verwandlung erzählen. Wir bauen die Verwandlung. " +
      "Jedes Stück Material trägt seine Herkunft, jede Bewegung ihre Messung — und was " +
      "entsteht, weiß, woraus es entstanden ist.",
    phase: "coagula",
  },
];

/** Der Satz, der die beiden Hälften benennt. Er steht auf dem Scharnier. */
export const SCHARNIER = { solve: "SOLVE", et: "ET", coagula: "COAGULA" } as const;

/** Wie viele Wörter ein Satz hat — der Prüfstand rechnet damit. */
export function woerter(satz: string): number {
  return satz.trim().split(/\s+/).filter(Boolean).length;
}
