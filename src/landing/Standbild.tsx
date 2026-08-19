/**
 * Ein Standbild in beiden Formaten.
 *
 * `<picture>` mit `media="(orientation: portrait)"` statt einer Entscheidung
 * in JavaScript: der Browser wählt die Quelle beim Parsen des Markups, also
 * bevor irgendein Skript gelaufen ist. Träfe die Wahl das Skript, zeigte der
 * erste Bildschirm für einen Moment den falschen Ausschnitt — und genau der
 * erste Bildschirm ist der, auf den es ankommt.
 */
export function Standbild(
  { name, klasse, alt }: { name: string; klasse?: string; alt: string },
) {
  return (
    <picture>
      <source media="(orientation: portrait)" srcSet={`/still/${name}-p.webp`} />
      <img src={`/still/${name}-l.webp`} alt={alt} className={klasse} />
    </picture>
  );
}
