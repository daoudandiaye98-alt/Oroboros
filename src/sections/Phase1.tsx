/**
 * Phase 1 — alles, was unter der Bühne liegt.
 *
 * EIN einziges Bündel, und es wird nachgeladen. Das ist kein Feinschliff,
 * sondern die Bedingung, unter der Phase 1 überhaupt an die Landing darf:
 * `reveal.ts` und `scrub.ts` bringen GSAP mit ScrollTrigger mit — rund 70 kB
 * gzip. `main.tsx` hält die Werkstatt aus genau diesem Grund aus dem
 * Hauptbündel heraus; die Landing wartet auf ihr erstes Bild, und ein
 * Abschnitt, den man erst nach 420 svh Rollweg sieht, hat auf diesem Pfad
 * nichts verloren.
 *
 * Zwei `lazy()`-Grenzen für zwei Abschnitte wären zwei Anfragen für dieselbe
 * Bibliothek. Deshalb liegt hier eine Hülle und nicht zwei Aufrufe.
 */
import Epochen from "./Epochen";
import Aktion from "./Aktion";

export default function Phase1() {
  return (
    <>
      <Epochen />
      <Aktion />
    </>
  );
}
