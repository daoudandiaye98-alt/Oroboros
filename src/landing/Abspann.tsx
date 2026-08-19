/**
 * Der Abspann — normaler Fluss, kein Pin.
 *
 * Er hält nur, was nach dem geschlossenen Kreis noch nötig ist: wer das war
 * und in welchem Jahr. Alles weitere — Menü, Formular, Leistungen, Preise —
 * steht ausdrücklich nicht im Auftrag und wird deshalb nicht erfunden.
 */
export function Abspann() {
  return (
    <footer className="abspann">
      <p className="kolumnentitel" style={{ margin: 0 }}>Oroboros Design</p>
      <p className="kolumnentitel" style={{ margin: 0, color: "rgba(244,237,226,.5)" }}>
        {new Date().getFullYear()}
      </p>
    </footer>
  );
}
