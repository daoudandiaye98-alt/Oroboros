/**
 * Die Kamera — welcher Frame, wie weit geschwenkt, und wie groß das Wort.
 *
 * ES WIRD NICHTS SKALIERT. Die Größe des Rings kommt aus der WAHL DES FRAMES,
 * die Lage aus einem Schwenk innerhalb der Overscan-Reserve — also innerhalb
 * dessen, was `cover` ohnehin abschneidet. Dadurch kann per Bauart kein Rand
 * frei werden und keine Füllfläche entstehen.
 *
 * ————————————————————————————————————————————————————————————————————————
 * DAS LOCKUP IST AUF DEM TELEFON ZENTRIERT UND AUF DEM SCHIRM NICHT
 * ————————————————————————————————————————————————————————————————————————
 *
 * §6 verlangt, die GESAMTBREITE zu zentrieren:
 *
 *     gesamtB    = ringD + luecke + textB
 *     linkeKante = (fensterB − gesamtB) / 2
 *     ringMitteX = linkeKante + ringD / 2
 *
 * Der Ring ist der erste Buchstabe des Wortes. Er steht also nicht dort, wo
 * die Typografie ihn hätte — er steht dort, wo das Tier im Bild liegt, und
 * das ist über die ganze Rückfahrt die Bildmitte (cx 0,44 bis 0,53). Das
 * Wort muss deshalb nach rechts, und der Ring muss nach links, und wie weit
 * er nach links kann, sagt allein die Overscan-Reserve.
 *
 * Gerechnet, mit den gemessenen Ringen:
 *
 *   390 × 844    Reserve ±118 px    nötig −117 px    → geht auf, Abweichung 0
 *   430 × 932    Reserve ±131 px    nötig −129 px    → geht auf, Abweichung 0
 *   1440 × 900   Reserve  ±85 px    nötig −538 px    → 453 px fehlen
 *   1920 × 1080  Reserve   ±6 px    nötig −765 px    → 759 px fehlen
 *    844 × 390   Reserve   ±0 px    nötig −333 px    → 333 px fehlen
 *
 * Der Unterschied ist keine Ungenauigkeit, sondern Geometrie: ein 3:4-Bild
 * auf einem schmalen Hochformat wird von `cover` um 38 % der Breite
 * beschnitten — das ist die Reserve. Ein 16:9-Bild auf 1440 × 900 überlappt
 * nur um 6 %, auf 1920 × 1080 gar nicht mehr.
 *
 * Auf dem Telefon steht das Lockup deshalb GENAU so, wie §6 es beschreibt:
 * Ring 55 px, Schrift 61 px, Zeile 342 von 390, Abweichung von der Mitte
 * unter einem Bildpunkt. Auf breiten Fenstern hängt es rechts der Mitte, und
 * die Schrift wird kleiner, als das Verhältnis 1,30 sie hätte — sonst liefe
 * sie aus dem Fenster. Beides steht im Bericht, mit Zahlen je Fenster.
 *
 * Der Ausweg wäre Material, nicht Code: eine Rückfahrt, die mit dem Ring
 * links im Bild endet statt in der Mitte. Dann fiele der Schwenk weg und die
 * Rechnung ginge in jedem Fenster auf.
 */

/** Ein Ring in einem Frame — Anteile der Bildbreite bzw. -höhe. */
export interface Ringmass {
  cx: number;
  cy: number;
  d: number;
}

/** Der Inhalt von `public/seq/<satz>/ring.json`. */
export interface Ringdaten {
  hauptFrames: number;
  bild: { breite: number; hoehe: number };
  ringe: Ringmass[];
}

/**
 * Wie groß der Ring im Verhältnis zum Fenster stehen soll.
 *
 * §6 nennt zwei Zeilen: 57 px auf 390 und 209 px auf 1440. Das sind 0,1462
 * und 0,1451 der Fensterbreite — dieselbe Zahl, zweimal gerundet. Hier steht
 * ihr Mittel.
 */
export const RING_ANTEIL = 0.1456;

/**
 * Der Ring misst 1,30 Versalhöhen.
 *
 * §6: „Eins zu eins wäre typografisch korrekt, lässt das Tier aber
 * verschwinden; darüber löst sich der Ring vom Wort."
 */
export const RING_ZU_VERSAL = 1.3;

/** Der Abstand zwischen Ring und dem R, in em der Schrift. */
export const LUECKE_EM = 0.1;

/** Was die Bühne für dieses Fenster ausgerechnet hat. */
export interface Aufbau {
  /** Index innerhalb der Rückfahrt. */
  rueckIndex: number;
  /** Wie viele Frames der Gesamtsequenz gebraucht werden. */
  frames: number;
  /** Außendurchmesser des Rings auf dem Schirm, in Bildpunkten. */
  ringD: number;
  /** Schriftgröße von „ROBOROS", in Bildpunkten. */
  schriftPx: number;
  /** Breite von Ring + Lücke + Wort. */
  gesamtB: number;
  /** Linke Kante des Lockups. */
  linkeKante: number;
  /** Der Schwenk in Bildpunkten. Negativ heißt: Bild nach links. */
  schwenk: number;
  /** Wie weit geschwenkt werden DARF, ohne einen Rand freizulegen. */
  grenze: number;
  /** Die Ringmitte auf dem Schirm, nach dem Schwenk. */
  ringX: number;
  ringY: number;
  /** Wie weit die Mitte des Lockups von der Fenstermitte abweicht. */
  mittenAbweichung: number;
  /** Das erreichte Verhältnis Ring zu Versalhöhe — 1,30, wo es aufgeht. */
  ringZuVersal: number;
  /** Der `cover`-Faktor und die gezeigte Bildbreite — für die Prüfung. */
  deckung: number;
  zeigB: number;
  overscanX: number;
}

/**
 * Rechnet den Aufbau für ein Fenster.
 *
 * @param daten        Der Inhalt von `ring.json`.
 * @param fensterB     Breite der Bühne in CSS-Bildpunkten.
 * @param fensterH     Höhe der Bühne.
 * @param rand         Luft, die die Zeile links und rechts behalten muss.
 *                     Enthält bereits `env(safe-area-inset-*)`.
 * @param wortEm       Breite von „ROBOROS" in em, an der GELADENEN Schrift
 *                     gemessen — samt Sperrung. Gegen die Ersatzschrift
 *                     gemessen sitzt das Lockup schief; das ist die Ursache
 *                     des Versatzes, den §6 benennt.
 * @param versalAnteil Versalhöhe in em, ebenfalls gemessen.
 * @returns `null`, wenn kein Frame das Zielmaß erreicht. Der Aufrufer meldet
 *          das — dann fehlt Bildmaterial, und das ist keine Codefrage.
 */
export function aufbauRechnen(
  daten: Ringdaten,
  fensterB: number,
  fensterH: number,
  rand: number,
  wortEm: number,
  versalAnteil: number,
): Aufbau | null {
  const { breite: bB, hoehe: bH } = daten.bild;
  const deckung = Math.max(fensterB / bB, fensterH / bH);
  const zeigB = bB * deckung;
  const zeigH = bH * deckung;
  const overscanX = (zeigB - fensterB) / 2;
  const overscanY = (zeigH - fensterH) / 2;

  /*
   * Die Schranke, und warum sie bei null anfängt.
   *
   * §3 des Kontinuitätsauftrags verlangt `|schwenk| + 2 <= overscanX`. Bei
   * overscanX = 0 — gemessen auf 844 × 390, wo das Fenster breiter liegt als
   * das Bild — verlangt das `|schwenk| <= −2`, was auch ein Schwenk von null
   * nicht erfüllt. Ein Schwenk von null legt aber nichts frei. Die Schranke
   * ist deshalb bei null abgefangen: dort steht das Bild eben still.
   */
  const grenze = Math.max(0, overscanX - 2);
  const zielD = RING_ANTEIL * fensterB;

  for (let i = 0; i < daten.ringe.length; i++) {
    const r = daten.ringe[i];
    const ringD = r.d * zeigB;
    // Vor dem Zielmaß ist der Ring zu groß. §5: die Bühne endet an dem Frame,
    // an dem er es erreicht — und keinen Frame später.
    if (ringD > zielD) continue;

    const ringRuhe = r.cx * zeigB - overscanX;

    /*
     * Der Schwenk will das Lockup zentrieren und darf die Reserve nicht
     * verlassen. Was danach übrig bleibt, ist die Abweichung — sie wird
     * gemeldet, nicht kaschiert.
     */
    const schriftVoll = ringD / (RING_ZU_VERSAL * versalAnteil);
    const gesamtVoll = ringD + (LUECKE_EM + wortEm) * schriftVoll;
    const soll = (fensterB - gesamtVoll) / 2 + ringD / 2;
    let schwenk = Math.max(-grenze, Math.min(grenze, soll - ringRuhe));

    // Die linke Kante darf nie in den Rand laufen. Steht der Ring nach dem
    // Schwenk zu weit links, wird zurückgenommen.
    let ringX = ringRuhe + schwenk;
    if (ringX - ringD / 2 < rand) {
      schwenk = Math.min(grenze, rand + ringD / 2 - ringRuhe);
      ringX = ringRuhe + schwenk;
    }
    const linkeKante = ringX - ringD / 2;

    /*
     * Passt die Zeile in §6-Größe nicht mehr ins Fenster, wird die SCHRIFT
     * kleiner, nicht der Ring. Der Ring trägt das Tier; ein Wort, das ein
     * paar Punkte kleiner steht, kostet nichts. Umgekehrt wäre es ein Fleck.
     */
    const platz = fensterB - rand - linkeKante - ringD;
    const schriftPx = Math.min(schriftVoll, platz / (LUECKE_EM + wortEm));
    if (schriftPx < schriftVoll * 0.3) continue;   // dann lieber ein späterer Frame
    const gesamtB = ringD + (LUECKE_EM + wortEm) * schriftPx;

    return {
      rueckIndex: i,
      frames: daten.hauptFrames + i + 1,
      ringD,
      schriftPx,
      gesamtB,
      linkeKante,
      schwenk,
      grenze,
      ringX,
      ringY: r.cy * zeigH - overscanY,
      mittenAbweichung: linkeKante + gesamtB / 2 - fensterB / 2,
      ringZuVersal: ringD / (schriftPx * versalAnteil),
      deckung,
      zeigB,
      overscanX,
    };
  }
  return null;
}
