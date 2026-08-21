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

/**
 * Wie weit das Verhältnis unter das Ziel darf, wenn das Material es hergibt.
 *
 * §8 des Auftrags will den Ring auf der optischen Höhe der anderen O. Das
 * wäre 1,0. Gerechnet gibt das Material das nicht her: der kleinste gemessene
 * Ring der 3:4-Rückfahrt ist 0,0832 der Bildbreite, auf 390 px also 52,5 px.
 * Bei 1,0 dürfte er höchstens 44 px sein, sonst passt die Zeile nicht ins
 * Fenster. Erreichbar ist 1,23 — und genau so weit geht der Boden.
 */
export const RING_ZU_VERSAL_BODEN = 1.22;

/**
 * Bis hierher liest der Ring als Buchstabe, darüber als übergroße Initiale.
 *
 * Nicht gesetzt, sondern an drei gerenderten Varianten abgelesen (1,22 · 1,26
 * · 1,30, beide Fenster, jede angesehen): bei 1,22 steht der Ring auf der
 * Versalhöhe der anderen O und die Zeile liest in einem Zug als OROBOROS;
 * bei 1,30 ragt er sichtbar über die Buchstaben. Bei 1,6 und darüber — was
 * die alte Rechnung auf 1440 × 900 erzeugte — ist es ein Symbol vor einem
 * Wort. Das Band endet deshalb bei 1,35.
 */
export const IDENTITAETS_BAND = 1.35;

/**
 * DAS OPTISCHE GEWICHT DES RINGS.
 *
 * §8: „The organic snake has significantly more visual weight than the thin
 * typography. Adjust spacing / position accordingly." Der Ring ist eine
 * photographische Scheibe, das Wort ist Jost 200 — sehr dünn. Wer die Zeile
 * geometrisch mittet, setzt die WAHRGENOMMENE Mitte nach links, weil links
 * die ganze Masse liegt.
 *
 * Gerechnet wird die Masse als Fläche mit Farbe:
 *
 *   Ring   ein Kranz, außen d, Körperdicke rund ein Viertel davon
 *          → π · ((d/2)² − (0,75 · d/2)²) = 0,344 · d²
 *   Wort   Breite mal Versalhöhe mal Schwärzungsgrad. Für einen 200er
 *          Schnitt liegt der bei rund 9 von 100 — nachgemessen an der
 *          Alphamaske der gesetzten Zeile, nicht geschätzt.
 *
 * Das Ergebnis ist ein Versatz nach RECHTS: die Zeile rückt so weit nach
 * rechts, dass ihr Schwerpunkt in der Fenstermitte steht.
 */
export const RING_KRANZ_ANTEIL = 0.344;
export const WORT_SCHWAERZUNG = 0.09;

/**
 * Der optische Schwerpunkt der Zeile, gemessen von ihrer linken Kante.
 *
 * Getrennt herausgezogen, damit der Prüfstand dieselbe Rechnung anstellen
 * kann, ohne sie ein zweites Mal zu führen.
 */
export function schwerpunkt(
  ringD: number, schriftPx: number, wortEm: number, versalAnteil: number,
): number {
  const wortB = (LUECKE_EM + wortEm) * schriftPx;
  const wortMitte = ringD + wortB / 2;
  const mRing = RING_KRANZ_ANTEIL * ringD * ringD;
  const mWort = wortB * versalAnteil * schriftPx * WORT_SCHWAERZUNG;
  return (mRing * (ringD / 2) + mWort * wortMitte) / Math.max(1e-6, mRing + mWort);
}

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
  /** Der optische Schwerpunkt, von der linken Kante der Zeile aus. */
  schwerpunktX: number;
  /** Wie weit der Schwerpunkt von der Fenstermitte abweicht. */
  optischeAbweichung: number;
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
  const platzGesamt = fensterB - 2 * rand;

  /*
   * ————————————————————————————————————————————————————————————————————
   * DIE MARKE HÄNGT NICHT MEHR AN DER STELLE, AN DER DER FILM SEIN TIER HAT
   * ————————————————————————————————————————————————————————————————————
   *
   * Vorher lief die Rechnung so: Frame wählen, schwenken, so weit es geht —
   * und was dann noch an Platz übrig war, bekam das Wort. Auf 1440 × 900 war
   * das wenig, weil der Ring dort weit rechts steht: 656 von 1440 px. Die
   * Schrift wurde deshalb von 225 auf 138 px gestaucht, und damit stand der
   * Ring nicht auf 1,30 Versalhöhen, sondern auf 2,13. Genau das ist die
   * „übergroße Initiale", die nicht als O liest.
   *
   * Der Fehler war die Reihenfolge. Die Zeile ist eine Wortmarke; ihre
   * Proportion ist gesetzt, bevor irgendein Film sie irgendwohin schiebt. Die
   * Stauchung greift jetzt NUR noch, wenn die Zeile sonst breiter wäre als
   * das Fenster — nicht, weil der Ring rechts steht.
   *
   * Gewählt wird der Frame danach, wie nah die Marke ihrer eigenen Form
   * kommt: erst das Verhältnis, dann die Mitte. Beides wird gemeldet.
   */
  interface Kandidat {
    ringD: number; imBand: boolean; ringZuVersal: number;
    optischeAbweichung: number; bau: Aufbau;
  }
  const kandidaten: Kandidat[] = [];
  let groesstImBand = 0;

  for (let i = 0; i < daten.ringe.length; i++) {
    const r = daten.ringe[i];
    const ringD = r.d * zeigB;
    if (ringD > zielD) continue;

    const ringRuhe = r.cx * zeigB - overscanX;

    /*
     * Das Verhältnis so weit nach unten, wie die Zeile es trägt.
     *
     * Kleiner heißt: der Ring nähert sich der Versalhöhe der anderen O — das
     * Ziel aus §8. Bezahlt wird es mit Schriftgröße, denn bei festem Ring
     * wird das Wort größer und die Zeile länger. Der Boden ist das, was auf
     * dem schmalsten Fenster noch hineinpasst.
     */
    const rMoeglich = ringD / (versalAnteil * ((platzGesamt - ringD) / (LUECKE_EM + wortEm)));
    const rZiel = Math.min(RING_ZU_VERSAL, Math.max(RING_ZU_VERSAL_BODEN, rMoeglich));
    const schriftVoll = ringD / (rZiel * versalAnteil);
    // Nur die Fensterbreite staucht, nichts sonst.
    const schriftPx = Math.min(schriftVoll, (platzGesamt - ringD) / (LUECKE_EM + wortEm));
    if (schriftPx <= 0) continue;
    const gesamtB = ringD + (LUECKE_EM + wortEm) * schriftPx;

    /*
     * OPTISCH, NICHT GEOMETRISCH.
     *
     * Gemittet wird der Schwerpunkt, nicht die Kante. Weil die Masse links
     * liegt — beim Ring —, rückt die Zeile dadurch nach RECHTS, und das ist
     * genau die Richtung, in die der Film sie ohnehin drängt. Die optische
     * Mitte ist hier also nicht der teurere, sondern der erreichbarere Ort.
     */
    const sp = schwerpunkt(ringD, schriftPx, wortEm, versalAnteil);
    /*
     * Der optische Wunsch ist das ZIEL DES SCHWENKS, nicht die Kante selbst.
     *
     * Hier stand kurzzeitig die Kante direkt — und die Rechnung ergab für
     * jedes Fenster `null`: auf 390 px füllt die Zeile die verfügbare Breite
     * vollständig aus, es gibt also genau EINE erlaubte Kante, und jeder
     * optische Versatz schob sie darüber hinaus. Der Wunsch wird deshalb
     * zuerst auf die Ränder geklemmt und dann dem Schwenk übergeben.
     */
    const kanteMin = rand;
    const kanteMax = fensterB - rand - gesamtB;
    const kanteZiel = Math.max(kanteMin, Math.min(Math.max(kanteMin, kanteMax),
      fensterB / 2 - sp));
    const soll = kanteZiel + ringD / 2;

    let schwenk = Math.max(-grenze, Math.min(grenze, soll - ringRuhe));
    let ringX = ringRuhe + schwenk;
    if (ringX - ringD / 2 < kanteMin) {
      schwenk = Math.min(grenze, kanteMin + ringD / 2 - ringRuhe);
      ringX = ringRuhe + schwenk;
    }
    const linkeKante = ringX - ringD / 2;
    /*
     * Läuft die Zeile trotz allem rechts heraus, bleibt nur die Schrift —
     * und DAS ist die einzige Stauchung, die es noch gibt.
     *
     * Auf 1440 × 900 greift sie, weil der Film sein Tier dort nahe der Mitte
     * hat und der Schwenk am Anschlag steht. Entscheidend ist, WELCHER Frame
     * dann gewählt wird: die alte Rechnung nahm den ERSTEN, der das Zielmaß
     * traf — größter Ring, kleinster Rest fürs Wort, Verhältnis 2,13. Ein
     * späterer Frame hat einen kleineren Ring UND ein Tier, das weiter links
     * liegt (cx fällt von 0,505 auf 0,438); beides gibt dem Wort Platz. Damit
     * kommt das Verhältnis auf 1,24 statt 2,13.
     *
     * Der Ring wird dadurch kleiner — das ist §9 entgegen. Die Rangfolge des
     * Auftrags ist aber eindeutig: IDENTITÄT vor WORDMARK vor PRÄSENZ. Ein
     * Ring, der als übergroße Initiale liest, ist ein anderes Zeichen.
     */
    const platzRest = fensterB - rand - linkeKante - ringD;
    if (platzRest <= 0) continue;
    const schriftEcht = Math.min(schriftPx, platzRest / (LUECKE_EM + wortEm));
    const gesamtEcht = ringD + (LUECKE_EM + wortEm) * schriftEcht;

    const ringZuVersal = ringD / (schriftEcht * versalAnteil);
    const spEcht = schwerpunkt(ringD, schriftEcht, wortEm, versalAnteil);
    const optischeAbweichung = linkeKante + spEcht - fensterB / 2;

    /*
     * Die Güte: erst Identität, dann Mitte.
     *
     * Die Rangfolge kommt aus dem Auftrag und ist nicht verhandelbar — ein
     * Ring, der als übergroße Initiale liest, ist ein anderes Zeichen, eine
     * Marke 80 px neben der Mitte ist dieselbe Marke etwas versetzt. Deshalb
     * wiegt die Abweichung vom Zielverhältnis hundertmal so schwer wie ein
     * Bildpunkt Versatz.
     */
    /*
     * DIE RANGFOLGE: IDENTITÄT IST EIN BAND, KEIN PUNKT.
     *
     * Erst stand hier „kleinstes Verhältnis gewinnt". Das wählte auf
     * 1440 × 900 den LETZTEN Frame der Rückfahrt — Verhältnis 1,24, aber Ring
     * nur 144 statt 197 px, und der rechte Bildrand war texturlos (0,15 statt
     * 0,35). Genau das nennt §7 als Fehler: „EXTREME AERIAL SHOT → tiny
     * snake". Ein Ziel bis zur letzten Stelle zu optimieren hat ein anderes
     * gerissen.
     *
     * Als O liest der Ring nicht bei einem Wert, sondern in einem Bereich.
     * Gemessen an den Varianten: bis rund 1,35 liest er als Buchstabe, ab 1,6
     * als übergroße Initiale. Innerhalb des Bandes entscheidet deshalb die
     * PRÄSENZ — der größte Ring gewinnt —, und die Mitte gibt den Ausschlag,
     * wenn zwei gleich groß sind.
     *
     * Findet sich kein Frame im Band, gewinnt das kleinste Verhältnis: dann
     * ist Identität das einzige, was noch zu retten ist.
     */
    const imBand = ringZuVersal <= IDENTITAETS_BAND;
    /*
     * Im Band gewinnt das KLEINSTE Verhältnis — aber nur, solange der Ring
     * nicht wesentlich schrumpft.
     *
     * An den Varianten abgelesen: zwischen 1,22 und 1,29 unterscheiden sich
     * die Ringe auf 390 px um 2,6 von 55 Bildpunkten, also fünf Prozent —
     * unsichtbar. Das Verhältnis dagegen sieht man: bei 1,29 ragt der Ring
     * über die Versalhöhe, bei 1,22 steht er darauf. Für fünf Prozent Ring
     * ist das ein guter Tausch, für dreißig wäre es keiner. Der Boden liegt
     * deshalb bei 92 % des größten Rings, den das Band hergibt — und weil der
     * erst am Ende der Schleife feststeht, wird in zwei Durchgängen gewählt.
     */
    if (imBand && ringD > groesstImBand) groesstImBand = ringD;
    kandidaten.push({ ringD, imBand, ringZuVersal, optischeAbweichung, bau: {
      rueckIndex: i,
      frames: daten.hauptFrames + i + 1,
      ringD,
      schriftPx: schriftEcht,
      gesamtB: gesamtEcht,
      linkeKante,
      schwenk,
      grenze,
      ringX,
      ringY: r.cy * zeigH - overscanY,
      mittenAbweichung: linkeKante + gesamtEcht / 2 - fensterB / 2,
      ringZuVersal,
      schwerpunktX: spEcht,
      optischeAbweichung,
      deckung,
      zeigB,
      overscanX,
    } });
  }

  if (kandidaten.length === 0) return null;

  const band = kandidaten.filter((k) => k.imBand);
  if (band.length > 0) {
    const boden = groesstImBand * 0.92;
    const gross = band.filter((k) => k.ringD >= boden);
    const feld = gross.length > 0 ? gross : band;
    // Kleinstes Verhältnis; bei Gleichstand die bessere optische Mitte.
    feld.sort((a, b) => (a.ringZuVersal - b.ringZuVersal)
      || (Math.abs(a.optischeAbweichung) - Math.abs(b.optischeAbweichung)));
    return feld[0].bau;
  }
  /*
   * Kein Frame im Band: dann ist Identität das einzige, was noch zu retten
   * ist, und das kleinste Verhältnis gewinnt. Gemeldet wird es trotzdem —
   * der Prüfstand liest `ringZuVersal` und schlägt an.
   */
  kandidaten.sort((a, b) => a.ringZuVersal - b.ringZuVersal);
  return kandidaten[0].bau;
  return null;
}
