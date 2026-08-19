/**
 * Das maschinenlesbare Register der dokumentierten Ausnahmen.
 *
 * Portiert aus `pawn-prototype/tools/pruefstand/ausnahmen.ts` — LEER, wie es
 * sich für ein neues Werk gehört. Die Struktur steht trotzdem schon da: eine
 * Ausnahme, die erst ein Gerüst braucht, wird nicht eingetragen, sondern
 * vergessen.
 *
 * DIE REGEL: eine dokumentierte Ausnahme zählt nicht in den Rückgabewert — der
 * Check bleibt grün und die Ausnahme steht sichtbar in der Statuszeile. ABER:
 * der Termin ist ein Wecker, kein Kommentar. Ist er verstrichen, zählt das Gate
 * wieder als gefallen — nicht weil sich die Seite verschlechtert hätte, sondern
 * weil die Entscheidung abgelaufen ist. Verlängern geht nur hier, als bewusste
 * Änderung mit Commit, nicht durch Wegsehen.
 *
 * Eine erledigte Ausnahme wird hier GELÖSCHT; im README bleibt sie mit Datum
 * als Protokoll stehen.
 */
export interface Ausnahme {
  /** Die Kontrolle, deren gefallene Befunde entschuldigt sind (z. B. "4.5"). */
  kontrolle: string;
  /** Wofür die Ausnahme steht — der Name aus dem README. */
  name: string;
  /** Der Termin als Meilenstein, so wie er im README steht. */
  termin: string;
  /**
   * Der Wecker: bis zu diesem Tag (einschließlich, UTC) gilt die Ausnahme.
   * Danach fällt das Gate wieder. ISO-Datum, damit der Lauf rechnen kann —
   * ein Meilenstein ohne Datum wäre ein Kommentar, kein Wecker.
   */
  wecker: string;
}

export const AUSNAHMEN: Ausnahme[] = [];

/** Die Ausnahme zu einem Befund — oder null, wenn keine greift. */
export function ausnahmeFuer(kontrolle: string, heute: string): Ausnahme | null {
  return AUSNAHMEN.find((a) => a.kontrolle === kontrolle && heute <= a.wecker) ?? null;
}

/** Die Ausnahmen, deren Wecker verstrichen ist — sie entschuldigen nichts mehr. */
export function abgelaufen(heute: string): Ausnahme[] {
  return AUSNAHMEN.filter((a) => heute > a.wecker);
}
