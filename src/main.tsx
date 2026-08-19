/**
 * Der Einstieg.
 *
 * Zwei Adressen: `/` — die Landing — und `/werkstatt`, der Selbsttest des
 * Werks aus Phase 0.
 *
 * KEIN ROUTER. Zwei Adressen sind eine Fallunterscheidung, keine Navigation;
 * eine Bibliothek dafür wäre Gewicht ohne Gegenwert. Kommt eine dritte Seite,
 * kommt der Router mit ihr.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import Landing from "./landing/Landing";
import Werkstatt from "./pages/Werkstatt";

const pfad = location.pathname.replace(/\/+$/, "");
const werkstatt = pfad === "/werkstatt";

/**
 * `canonical` je Adresse.
 *
 * Ohne sie hält eine Suchmaschine jede Variante derselben Seite (mit
 * Parametern, mit und ohne Schrägstrich) für eine eigene. In `index.html`
 * kann sie nicht stehen — dort ist die Adresse noch nicht bekannt.
 */
function kanonisch() {
  const vorhanden = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const link = vorhanden ?? document.createElement("link");
  link.rel = "canonical";
  link.href = location.origin + (pfad || "/");
  if (!vorhanden) document.head.appendChild(link);
}

function kopfdaten(titel: string, beschreibung: string) {
  document.title = titel;
  document.querySelector('meta[name="description"]')?.setAttribute("content", beschreibung);
}

if (werkstatt) {
  kopfdaten(
    "Werkstatt — der Selbsttest des Werks",
    "Vier nackte Beweisblöcke für Spalter, Auftritt, Scrub und Nachziehen.",
  );
  /*
   * Die Werkstatt gehört in kein Verzeichnis.
   *
   * Sie bleibt dauerhaft im Template — in Kundenforks wird sie nicht
   * gelöscht, sondern ausgeschlossen. Gesetzt wird das hier und nicht in
   * `index.html`, weil dieselbe Hülle auch die Landing ausliefert, und die
   * soll sehr wohl gefunden werden.
   */
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex, nofollow";
  document.head.appendChild(robots);
} else {
  document.documentElement.classList.add("landing");
}
kanonisch();

createRoot(document.getElementById("wurzel")!).render(
  <StrictMode>{werkstatt ? <Werkstatt /> : <Landing />}</StrictMode>,
);
