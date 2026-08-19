/**
 * OROBOROS — zeichenweise.
 *
 * Jeder Buchstabe fährt aus einem eigenen Schacht nach oben herein. Der
 * Schacht (`overflow: hidden`) ist der Grund, warum man die Buchstaben nicht
 * vorher unterhalb der Zeile stehen sieht.
 *
 * BARRIEREFREIHEIT: Der Container trägt `aria-label` mit dem ganzen Wort, die
 * Zeichen sind `aria-hidden`. Ein Screenreader, der acht Einzelbuchstaben
 * vorliest, macht aus einer Wortmarke ein Buchstabieren. Dieselbe Regel wie
 * in `src/motion/split.ts` — hier eigens gesetzt, weil die Zeichen wegen der
 * Schächte anders verschachtelt sind als dort.
 */
export function Wortmarke({ text, auf }: { text: string; auf: boolean }) {
  return (
    <div className={`wortmarke${auf ? " auf" : ""}`} aria-label={text}>
      {Array.from(text).map((zeichen, i) => (
        <span className="schacht" aria-hidden="true" key={`${zeichen}-${i}`}>
          <span
            className="zeichen zeichen-schacht"
            style={{ "--i": i } as React.CSSProperties}
          >
            {zeichen}
          </span>
        </span>
      ))}
    </div>
  );
}
