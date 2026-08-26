/**
 * Abschnitt 06 — HANDLUNG: der eine Weg.
 *
 * **Dieser Abschnitt ist absichtlich unfertig.** Der Release führt ihn als
 * ERZEUGEN mit dem Vermerk: *„Ein Satz und ein Weg. Text und Ziel fehlen —
 * nur Daouda kann sagen, worum die Anfrage geht."*
 *
 * Er wird nicht mit „Kontakt" oder „Let's talk" gefüllt. Ein erfundener CTA
 * wäre schlimmer als eine Lücke: die Lücke sagt, dass etwas fehlt; der
 * erfundene Satz sagt, dass nichts fehlt, und das stimmt nicht.
 *
 * Stattdessen steht hier die Bühne, das Siegel — und `data-luecke`, an dem
 * der Prüfstand die offene Stelle als **Befund** meldet, nicht als Fehler.
 * Sobald der Satz da ist, wird aus der Lücke ein Weg, und der Rest dieser
 * Datei bleibt, wie er ist.
 */
import { useEffect, useRef } from "react";
import { auftritt } from "../motion/reveal";

/** Der Name der Lücke. Er steht im Markup, im Prüfstand und im Release. */
export const LUECKE = "der-eine-weg";

export default function Aktion() {
  const abschnitt = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = abschnitt.current;
    if (el) auftritt(el);
  }, []);

  return (
    <section
      className="aktion"
      ref={abschnitt}
      aria-labelledby="aktion-titel"
      data-abschnitt="action"
      data-luecke={LUECKE}
      data-auftritt="aktion"
    >
      <p className="kicker verborgen" data-rolle="marginalie">Der eine Weg</p>
      <h2 className="aktion-titel verborgen" id="aktion-titel" data-rolle="schlagzeile">
        Hier steht ein Satz, den nur einer schreiben kann
      </h2>
      <p className="aktion-satz verborgen" data-rolle="zeile">
        Dieser Abschnitt ist offen. Der Release nennt ihn als zu erzeugen: ein Satz
        und ein Ziel. Beides fehlt, und beides zu erfinden hieße, den einzigen Teil
        der Seite zu behaupten, den sie nicht beweisen kann.
      </p>
      <p className="aktion-marke verborgen" data-rolle="zeile">
        Offene Lücke · <code>{LUECKE}</code>
      </p>
    </section>
  );
}
