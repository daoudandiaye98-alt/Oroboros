/**
 * Die Kamera — welcher Frame, und wie weit geschwenkt.
 *
 * ES WIRD NICHTS MEHR SKALIERT. Bis zum Kontinuitäts-Auftrag wurde der Ring am
 * Ende auf sein Zielmaß geschrumpft — ein Maßstabsfaktor auf dem Bild. Weil es
 * damit kleiner wurde als sein Fenster, blieb ein Rand frei, der mit dem
 * mittleren Sandton gefüllt wurde. Diese Füllung ist die sichtbare Kante
 * gewesen — texturlos, mittlere Nachbardifferenz 1,79 gegen 1,52 im echten
 * Bild —, und ROBOROS lief hinein.
 *
 * Jetzt kommt die Größe des Rings aus der WAHL DES FRAMES. Die Rückfahrt
 * durchläuft zehn Sekunden lang jedes Maß; `ring.json` sagt zu jedem Frame, wo
 * der Ring steht und wie groß er ist. Bewegt wird nur noch innerhalb der
 * Overscan-Reserve — also innerhalb dessen, was `cover` ohnehin abschneidet.
 * Dadurch kann per Bauart kein Rand frei werden.
 *
 * ————————————————————————————————————————————————————————————————————————
 * WAS DER AUFTRAG VORSAH UND WARUM ES NICHT GEHT
 * ————————————————————————————————————————————————————————————————————————
 *
 * §3 schreibt vor, den Ring an den linken Rand zu schwenken:
 *
 *     zielX   = seitenrand + zielD_px / 2
 *     schwenk = zielX − ringSchirmX
 *
 * Nachgerechnet mit den gemessenen Daten:
 *
 *   1440 × 900   overscanX  87 px   nötiger Schwenk  −540 px
 *    844 × 390   overscanX   0 px   nötiger Schwenk  −284 px
 *
 * Der Grund ist keine Ungenauigkeit, sondern die Lage des Tieres im Bild: sein
 * Ring sitzt über die ganze Rückfahrt bei cx ≈ 0,51, also in der Bildmitte. Ihn
 * an den linken Rand zu bringen heißt, das Bild um eine halbe Fensterbreite zu
 * verschieben — und die Overscan-Reserve ist ein paar Prozent. Der in §3
 * vorgesehene Ausweg (ein früherer Frame) hilft nicht: cx ändert sich über die
 * ganze Fahrt um 0,06.
 *
 * Auf 844 × 390 ist die Reserve sogar genau null, weil das Fenster breiter
 * liegt als das Bild und `cover` dort über die Höhe deckt. Dort ist JEDER
 * Schwenk außer null ein freier Rand.
 *
 * Deshalb ist die Abhängigkeit umgedreht: nicht der Ring geht zum Wort,
 * sondern DAS WORT GEHT ZUM RING. Gewählt wird der früheste Frame — also der
 * größte Ring —, bei dem die ganze Zeile ins Fenster passt. Der Schwenk dient
 * nur noch dazu, sie hineinzuschieben, wenn sie knapp übersteht, und ist
 * meistens null.
 *
 * Der Preis steht im Bericht: der Ring erreicht 12,6 bis 21,7 % der
 * Fensterbreite statt der vorgesehenen 23,1 %. Er ist so groß, wie ihn ein
 * Fenster tragen kann, ohne dass irgendwo Bild fehlt.
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
 * Das Verhältnis von Ring zu Versalhöhe.
 *
 * 330 zu 198 auf 1440, 90 zu 54 auf 390 — beides derselbe Faktor. Der Ring ist
 * absichtlich größer als die Versalhöhe: ein O in Schriftgröße läse sich als
 * Satzfehler, ein deutlich größeres als Zeichen.
 */
export const RING_ZU_SCHRIFT = 5 / 3;

/** Der Abstand zwischen Ring und Wort, in em der Schrift. */
export const ABSTAND_EM = 0.12;

/** Wie breit der Ring im Verhältnis zum Fenster stehen SOLL, wenn er darf. */
export const RING_ANTEIL = 0.231;

/** Was die Bühne für dieses Fenster ausgerechnet hat. */
export interface Aufbau {
  /** Index innerhalb der Rückfahrt. */
  rueckIndex: number;
  /** Wie viele Frames der Gesamtsequenz gebraucht werden. Der Rest wird nicht geladen. */
  frames: number;
  /** Durchmesser des Rings auf dem Schirm, in Bildpunkten. */
  ringPx: number;
  /** Schriftgröße von „ROBOROS", in Bildpunkten. */
  schriftPx: number;
  /** Breite der ganzen Zeile, in Bildpunkten. */
  zeileB: number;
  /** Der Schwenk in Bildpunkten. Negativ heißt: Bild nach links. */
  schwenk: number;
  /** Wie weit geschwenkt werden DARF, ohne einen Rand freizulegen. */
  grenze: number;
  /** Die Ringmitte auf dem Schirm, nach dem Schwenk. */
  ringX: number;
  ringY: number;
  /** Der `cover`-Faktor und die gezeigte Bildbreite — für die Prüfung. */
  deckung: number;
  zeigB: number;
  overscanX: number;
}

/**
 * Rechnet den Aufbau für ein Fenster.
 *
 * @param daten     Der Inhalt von `ring.json`.
 * @param fensterB  Breite der Bühne in CSS-Bildpunkten.
 * @param fensterH  Höhe der Bühne.
 * @param rand      Wie viel Luft die Zeile links und rechts behalten muss.
 *                  Enthält bereits `env(safe-area-inset-*)`.
 * @param wortEm    Breite von „ROBOROS" in em, an der geladenen Schrift
 *                  gemessen. Geraten wäre sie bei jedem Schriftwechsel falsch.
 * @returns `null`, wenn kein einziger Frame passt. Der Aufrufer meldet das —
 *          dann fehlt Bildmaterial, und das ist keine Codefrage.
 */
export function aufbauRechnen(
  daten: Ringdaten,
  fensterB: number,
  fensterH: number,
  rand: number,
  wortEm: number,
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
   * Der Auftrag verlangt `|schwenk| + 2 <= overscanX`. Bei overscanX = 0 —
   * gemessen auf 844 × 390, wo das Fenster breiter liegt als das Bild —
   * verlangt das `|schwenk| <= −2`, was auch ein Schwenk von null nicht
   * erfüllt. Ein Schwenk von null legt aber nichts frei. Die Schranke ist
   * deshalb bei null abgefangen: dort steht das Bild eben still.
   */
  const grenze = Math.max(0, overscanX - 2);

  const zielD = RING_ANTEIL * fensterB;
  /** Die Zeilenbreite in Vielfachen des Ringdurchmessers. */
  const zeileJeRing = 1 + (ABSTAND_EM + wortEm) / RING_ZU_SCHRIFT;

  let gewaehlt: Aufbau | null = null;
  for (let i = 0; i < daten.ringe.length; i++) {
    const r = daten.ringe[i];
    const ringPx = r.d * zeigB;
    const zeileB = ringPx * zeileJeRing;
    // Wo der Ring ohne Schwenk stünde.
    const ringRuhe = r.cx * zeigB - overscanX;

    /*
     * Der Schwenk hat zwei Bedingungen und muss beide erfüllen: die Zeile darf
     * links nicht aus dem Fenster laufen und rechts nicht. Daraus wird ein
     * Intervall, das mit der Overscan-Schranke geschnitten wird.
     */
    const von = Math.max(rand + ringPx / 2 - ringRuhe, -grenze);
    const bis = Math.min(fensterB - rand - zeileB + ringPx / 2 - ringRuhe, grenze);
    if (von > bis + 1e-9) continue;

    // Von den erlaubten Schwenks der kleinste — das Bild soll möglichst so
    // stehen bleiben, wie der Film es gerahmt hat.
    const schwenk = von <= 0 && bis >= 0 ? 0 : Math.abs(von) < Math.abs(bis) ? von : bis;

    gewaehlt = {
      rueckIndex: i,
      frames: daten.hauptFrames + i + 1,
      ringPx,
      schriftPx: ringPx / RING_ZU_SCHRIFT,
      zeileB,
      schwenk,
      grenze,
      ringX: ringRuhe + schwenk,
      ringY: r.cy * zeigH - overscanY,
      deckung,
      zeigB,
      overscanX,
    };

    /*
     * Passt der Ring schon unter das gewünschte Maß, ist der Frame gefunden.
     * Sonst weiter zu einem SPÄTEREN Frame — der Ring wird kleiner, die Zeile
     * schmaler, und irgendwann passt sie.
     *
     * Der Auftrag sieht an dieser Stelle einen FRÜHEREN Frame vor. Das folgt
     * aus seiner Bedingung, in der der Schwenk klemmt: ein größerer Ring
     * verschiebt das Ziel zum Ring hin. Hier klemmt die Zeilenbreite, und die
     * wächst mit dem Ring — die Richtung dreht sich um.
     */
    if (ringPx <= zielD) break;
  }
  return gewaehlt;
}
