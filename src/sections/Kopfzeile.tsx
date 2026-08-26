/**
 * Die Naht — die Wortmarke bleibt.
 *
 * Die gefährlichste Stelle der Seite: eine Choreografie, die in ein Layout
 * kippt. Die Landing endet mit dem Siegel auf `--tief`; Phase 1 beginnt
 * darunter. Wäre die Wortmarke im Lockup ein Element und in der Kopfzeile
 * ein zweites, sähe man beim Übergang beide — oder, schlimmer, keine.
 *
 * **Ein Element, das wandert.** Die Kopfzeile ist `position: sticky` und
 * beginnt unsichtbar. Sie erscheint erst, wenn die Bühne der Landing zu Ende
 * ist — nicht früher: §4 des Landing-Auftrags sagt, die erste und einzige
 * Nennung der Marke ist das Schlussbild. Eine Kopfzeile, die von Anfang an
 * mitläuft, nähme dem Schlussbild genau das.
 *
 * Der Ring wird zum Zeichen: 24 px, dieselbe Form, kein zweites Motiv.
 */
import { useEffect, useRef, useState } from "react";

export default function Kopfzeile({ buehne }: { buehne: React.RefObject<HTMLElement | null> }) {
  const [sichtbar, setSichtbar] = useState(false);
  const kopf = useRef<HTMLElement>(null);

  useEffect(() => {
    const ziel = buehne.current;
    if (!ziel) return;
    /*
     * Beobachtet wird das ENDE der Bühne, nicht der Rollstand.
     *
     * Ein Rollstand wäre eine Zahl, die hier stünde — und Zahlen stehen in
     * `bewegung.css`. Ein Beobachter am Ende der Bühne braucht keine: er
     * meldet, was ohnehin wahr ist.
     */
    const beobachter = new IntersectionObserver(
      ([eintrag]) => setSichtbar(Boolean(eintrag && !eintrag.isIntersecting)),
      { rootMargin: "0px 0px -100% 0px" },
    );
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, [buehne]);

  return (
    <header className="kopfzeile" ref={kopf} data-sichtbar={sichtbar ? "1" : "0"}>
      <a className="kopfzeile-marke" href="#" aria-label="OROBOROS — zum Anfang">
        <span className="kopfzeile-ring" aria-hidden="true" />
        <span className="kopfzeile-wort">ROBOROS</span>
      </a>
    </header>
  );
}
