/**
 * Was Phase 1 zeigt.
 *
 * Die Reihenfolge ist die des Plans, nicht die des Imports: Abschnitt 04
 * (story) kommt vor Abschnitt 06 (action), weil der Frame `experience` sagt
 * *„Nichts verkaufen, bevor etwas erlebt wurde"*. Abschnitt 05 (reveal) ist
 * die Landing selbst und steht deshalb nicht hier.
 */
export { default as Epochen } from "./Epochen";
export { default as Aktion } from "./Aktion";
export { default as Kopfzeile } from "./Kopfzeile";
export { EPOCHEN, SCHARNIER, woerter, type Epoche } from "./epochen";
export { LUECKE } from "./Aktion";
