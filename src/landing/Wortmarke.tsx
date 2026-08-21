/**
 * Ein Wort, zeichenweise.
 *
 * Jeder Buchstabe fährt aus einem eigenen Schacht nach oben herein. Der
 * Schacht (`overflow: hidden`) ist der Grund, warum man die Buchstaben nicht
 * vorher unterhalb der Zeile stehen sieht.
 *
 * EIN AUFTRITT, ZWEI FASSUNGEN. Im Schlussbild steht ROBOROS neben dem Ring,
 * der das erste O IST; im Ruhemodus, wo keine Kamera rechnet und kein Ring an
 * seiner Stelle steht, das ganze OROBOROS. Am ANFANG der Seite steht die Marke
 * nicht mehr — §4 des Prolog-Auftrags: „Erste und einzige Nennung der Marke
 * ist das Schlussbild."
 *
 * BARRIEREFREIHEIT: Der Container trägt `aria-label` mit dem ganzen Wort, die
 * Zeichen sind `aria-hidden`. Ein Screenreader, der acht Einzelbuchstaben
 * vorliest, macht aus einer Wortmarke ein Buchstabieren. Am Ende ist das
 * `aria-label` OROBOROS, obwohl nur ROBOROS geschrieben steht: das O ist da,
 * es ist bloß ein Bild — und wer die Seite hört statt sieht, soll das Wort
 * bekommen, nicht die Lücke.
 */
export interface WortmarkeEigenschaften {
  text: string;
  auf: boolean;
  /** Die Klasse der Zeile. `wortmarke` am Anfang, `lockup-wort` am Ende. */
  klasse?: string;
  /** Was vorgelesen wird, falls es nicht `text` ist. */
  beschriftung?: string;
  /**
   * Referenz auf die Zeile — die Kamera misst an ihr die Wortbreite.
   *
   * Sie muss an der ECHTEN Zeile mit der ECHTEN Schrift gemessen werden: aus
   * ihr folgt, welcher Frame gewählt wird, und eine geratene Breite hieße ein
   * falscher Frame, den man erst in der Aufnahme sieht.
   */
  aussen?: React.RefObject<HTMLDivElement | null>;
}

export function Wortmarke({
  text, auf, klasse = "wortmarke", beschriftung, aussen,
}: WortmarkeEigenschaften) {
  return (
    <div ref={aussen} className={`${klasse}${auf ? " auf" : ""}`} aria-label={beschriftung ?? text}>
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
