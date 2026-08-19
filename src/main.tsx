/**
 * Der Einstieg.
 *
 * Es gibt genau zwei Adressen: `/werkstatt` — der Selbsttest des Werks — und
 * alles andere, das in Phase 0 bewusst leer ist.
 *
 * KEIN Router. Ein Router wäre eine weitere Abhängigkeit für eine einzige
 * Fallunterscheidung; er kommt in Phase 1, wenn es mehr als eine Seite gibt
 * und die Entscheidung eine Begründung trägt.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import Werkstatt from "./pages/Werkstatt";

/**
 * `canonical` je Adresse.
 *
 * Steht im Kopf keine kanonische Adresse, hält eine Suchmaschine jede Variante
 * derselben Seite (mit Parametern, mit und ohne Schrägstrich) für eine eigene.
 * In `index.html` kann sie nicht stehen — dort ist die Adresse noch nicht
 * bekannt.
 */
function kanonisch() {
  const vorhanden = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const link = vorhanden ?? document.createElement("link");
  link.rel = "canonical";
  link.href = location.origin + location.pathname.replace(/\/+$/, "") || location.origin;
  if (!vorhanden) document.head.appendChild(link);
}

/** Die leere Wurzel der Phase 0. Kein Hero, keine Sektion, kein Text. */
function Leer() {
  return (
    <main style={{ font: "16px/1.5 system-ui, sans-serif", padding: "2rem" }}>
      <h1 style={{ font: "inherit", fontWeight: 700, margin: 0 }}>oroboros-werk</h1>
      <p style={{ margin: "0.5rem 0 0" }}>
        Phase 0 — Fundament. Der Selbsttest liegt unter <a href="/werkstatt">/werkstatt</a>.
      </p>
    </main>
  );
}

const werkstatt = location.pathname.replace(/\/+$/, "") === "/werkstatt";

if (werkstatt) {
  document.title = "Werkstatt — der Selbsttest des Werks";
  document.querySelector('meta[name="description"]')
    ?.setAttribute("content", "Vier nackte Beweisblöcke für Spalter, Auftritt, Scrub und Nachziehen.");
}
kanonisch();

createRoot(document.getElementById("wurzel")!).render(
  <StrictMode>{werkstatt ? <Werkstatt /> : <Leer />}</StrictMode>,
);
