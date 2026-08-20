/**
 * Der Ring, in jedem Frame gemessen.
 *
 * WARUM DAS EIN EIGENES MODUL IST. Bis zum Kontinuitäts-Auftrag stand die Lage
 * des Rings als drei Zahlen je Satz im Quelltext, von Hand an einem einzigen
 * Frame abgelesen. Damit gab es genau EIN Maß — und jedes andere musste durch
 * Skalieren erreicht werden. Genau daraus entstand die sichtbare Kante: ein
 * Bild, das kleiner ist als sein Fenster, hat einen Rand.
 *
 * Jetzt wird jeder Frame vermessen. Die Größe kommt danach aus der WAHL des
 * Frames, nicht aus einer Transformation, und es gibt nichts mehr zu füllen.
 *
 * ————————————————————————————————————————————————————————————————————————
 * DAS VERFAHREN — UND WARUM ES NICHT DAS AUS DEM AUFTRAG IST
 * ————————————————————————————————————————————————————————————————————————
 *
 * Der Auftrag schreibt vor: Graustufen, Schwelle Median − 9, größte
 * zusammenhängende Region mit Seitenverhältnis 0,6…1,7 in der unteren linken
 * Bildhälfte. Das ist gebaut und an der Tabelle aus §2 geprüft worden. Es
 * misst nicht den Ring, sondern die KUHLE MIT IHREM AUSSENSCHATTEN, und zwar
 * mit einem Fehler, der mit der Rückfahrt wächst:
 *
 *   Zeit          1,5 s   3,0 s   4,5 s   6,0 s   7,5 s   9,0 s
 *   Auftrag       0,551   0,430   0,256   0,164   0,101   0,072
 *   Schwellwert   0,572   0,500   0,306   0,216   0,153   0,450
 *   Verhältnis     1,04    1,16    1,20    1,32    1,51      —
 *
 * Bei 9,0 s bricht es ganz: der glatte Schatten am Dünenkamm ist dann größer
 * als die Kuhle, erfüllt dieselben Bedingungen und gewinnt. Gemessen wurde
 * cx 0,223 statt 0,420 — der Ring läge über hundert Bildpunkte neben seinem
 * Buchstaben, und zwar ohne dass irgendetwas eine Fehlermeldung ausgäbe.
 *
 * Ein Schwellwert kann diese Aufgabe nicht lösen, und der Grund ist im
 * Material nachgemessen: Schlangenkörper und Sand haben dieselbe Farbe. An
 * `film-16x9/f150.webp` — Körper rgb(228,186,122), Sand rgb(215,176,121),
 * Sättigung 0,465 gegen 0,437. Was den Ring auszeichnet, ist keine Helligkeit,
 * sondern eine FORM: ein heller Kranz um eine dunkle Mitte.
 *
 * Genau darauf antwortet dieser Detektor. Für einen Kandidaten (Mitte, Radius)
 * bildet er
 *
 *     Antwort = Mittel auf dem Kreis(r) − Mittel in der Scheibe(0,55 r)
 *
 * und sucht das Maximum. Der Außenschatten der Kuhle ist innen wie außen
 * dunkel und bekommt eine niedrige Antwort; der Dünenschatten hat keine helle
 * Umrandung und bekommt eine negative. Beide Fehlerfälle fallen weg, ohne dass
 * eine Sonderregel nötig wäre.
 *
 * VERFOLGT STATT JEDES MAL NEU GESUCHT. Die Rückfahrt ist EINE Einstellung:
 * der Ring wandert stetig und schrumpft monoton. Frame 0 wird darum breit
 * gesucht, jeder weitere nur in einem engen Fenster um seinen Vorgänger. Das
 * ist nicht bloß schneller — es macht einen Fehlgriff auf einen zufällig
 * ähnlichen Fleck am anderen Bildrand unmöglich.
 *
 * Gemessen wird auf einer verkleinerten Fassung (Breite 320). Das ist kein
 * Sparzweck: in voller Auflösung antwortet die Sandkörnung mit, und der Kranz
 * geht darin unter.
 */
import sharp from "sharp";

/** Auf diese Breite wird zum Messen verkleinert. */
const MESSBREITE = 320;

/** Wie viele Punkte auf dem Kranz abgetastet werden. */
const KRANZ_PUNKTE = 72;

/** Wie viele Punkte in der Mitte. */
const MITTE_PUNKTE = 48;

/** Der Anteil des Radius, bis zu dem die Mitte gemessen wird. */
const MITTE_ANTEIL = 0.55;

/** Graustufen in voller Messbreite lesen. */
async function grau(quelle) {
  const { data, info } = await sharp(quelle)
    .greyscale()
    .resize({ width: MESSBREITE })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { d: data, b: info.width, h: info.height };
}

/**
 * Die Antwort eines Kandidaten: heller Kranz minus dunkle Mitte.
 *
 * Läuft ein Tastpunkt aus dem Bild, gilt der Kandidat als ungültig (−∞). Ein
 * halb abgeschnittener Kreis bekäme sonst eine Antwort aus der Hälfte, die
 * noch im Bild liegt, und könnte einen ganzen schlagen.
 */
function antwort({ d, b, h }, cx, cy, r) {
  let kranz = 0;
  for (let i = 0; i < KRANZ_PUNKTE; i++) {
    const w = (i / KRANZ_PUNKTE) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(w) * r);
    const y = Math.round(cy + Math.sin(w) * r);
    if (x < 0 || y < 0 || x >= b || y >= h) return -Infinity;
    kranz += d[y * b + x];
  }
  let mitte = 0;
  for (let i = 0; i < MITTE_PUNKTE; i++) {
    // Goldener Winkel und Wurzel-Radius: gleichmäßig über die Fläche verteilt,
    // nicht in der Mitte gehäuft wie ein naives Polarraster.
    const w = i * 2.399963;
    const rr = Math.sqrt((i + 0.5) / MITTE_PUNKTE) * r * MITTE_ANTEIL;
    const x = Math.round(cx + Math.cos(w) * rr);
    const y = Math.round(cy + Math.sin(w) * rr);
    if (x < 0 || y < 0 || x >= b || y >= h) return -Infinity;
    mitte += d[y * b + x];
  }
  return kranz / KRANZ_PUNKTE - mitte / MITTE_PUNKTE;
}

/**
 * Die Antwort auf die AUSSENKANTE: hell auf dem Körper, dunkel daneben.
 *
 * Der Kranz-Detektor oben findet die MITTELLINIE des Schlangenkörpers — dort
 * ist der Kreis am hellsten. Gebraucht wird aber die Außenkante: sie ist es,
 * die als Buchstabe gelesen wird. An `rueckfahrt-3x4` Frame 40 gemessen:
 * Mittellinie 0,2007, Außenkante 0,2231 der Bildbreite. Zehn Prozent, und auf
 * einem 390 px breiten Fenster sind das neun Bildpunkte Versatz gegen den
 * Buchstaben — mehr als die drei, die noch als „sitzt" durchgehen.
 *
 * Ein fester Umrechnungsfaktor wäre falsch. Er lag bei Frame 0 bei 1,018 und
 * bei Frame 40 bei 1,112, weil der Kranz-Detektor sich im Lauf der Verfolgung
 * von der Ankermessung löst und auf sein eigenes Maximum zurückfällt. Ein
 * Faktor hätte den Fehler mitgeführt, statt ihn zu beheben.
 *
 * Gesucht wird deshalb direkt die Kante: innen (0,92 R) liegt der Körper, außen
 * (1,12 R) der Schatten des Kuhlenrandes. Die Differenz ist genau dort am
 * größten, wo der Körper aufhört.
 */
function kantenAntwort({ d, b, h }, cx, cy, R) {
  let innen = 0, aussen = 0;
  for (let i = 0; i < KRANZ_PUNKTE; i++) {
    const w = (i / KRANZ_PUNKTE) * Math.PI * 2;
    const co = Math.cos(w), si = Math.sin(w);
    const xi = Math.round(cx + co * R * 0.92), yi = Math.round(cy + si * R * 0.92);
    const xa = Math.round(cx + co * R * 1.12), ya = Math.round(cy + si * R * 1.12);
    if (xi < 0 || yi < 0 || xi >= b || yi >= h) return -Infinity;
    if (xa < 0 || ya < 0 || xa >= b || ya >= h) return -Infinity;
    innen += d[yi * b + xi];
    aussen += d[ya * b + xa];
  }
  return (innen - aussen) / KRANZ_PUNKTE;
}

/**
 * Sucht die Außenkante ab einem bekannten Mittellinienradius — und zieht dabei
 * die Mitte nach.
 *
 * Die Mitte kommt aus dem Kranz-Detektor und ist gut, aber nicht genau: an
 * Frame 40 lag sie 0,0067 der Bildbreite neben der Handmessung, also 5,5
 * Bildpunkte. Die Kantenantwort ist die schärfere von beiden — sie misst einen
 * Übergang statt einer Fläche — und darf die Mitte deshalb korrigieren.
 */
/** Sucht das Beste in einem Gitter und verfeinert es zweimal. */
function suchen(bild, mitteX, mitteY, mitteR, spanneXY, spanneR, schritte) {
  let best = { cx: mitteX, cy: mitteY, r: mitteR, a: -Infinity };
  let sxy = spanneXY, sr = spanneR;
  for (let runde = 0; runde < 3; runde++) {
    const schrittXY = Math.max(1, (2 * sxy) / schritte);
    const schrittR = Math.max(0.5, (2 * sr) / schritte);
    const zx = best.cx, zy = best.cy, zr = best.r;
    for (let x = zx - sxy; x <= zx + sxy; x += schrittXY) {
      for (let y = zy - sxy; y <= zy + sxy; y += schrittXY) {
        for (let r = Math.max(3, zr - sr); r <= zr + sr; r += schrittR) {
          const a = antwort(bild, x, y, r);
          if (a > best.a) best = { cx: x, cy: y, r, a };
        }
      }
    }
    sxy = schrittXY;
    sr = schrittR;
  }
  return best;
}

function kanteSuchen(bild, cx0, cy0, rMitte) {
  const radiusSuchen = (cx, cy, von, bis, schritt) => {
    let b = { R: von, a: -Infinity };
    for (let R = von; R <= bis; R += schritt) {
      const a = kantenAntwort(bild, cx, cy, R);
      if (a > b.a) b = { R, a };
    }
    return b;
  };
  const mitteSuchen = (R, cx, cy, spanne) => {
    let b = { cx, cy, a: kantenAntwort(bild, cx, cy, R) };
    const schritt = Math.max(0.5, spanne / 4);
    for (let x = cx - spanne; x <= cx + spanne; x += schritt) {
      for (let y = cy - spanne; y <= cy + spanne; y += schritt) {
        const a = kantenAntwort(bild, x, y, R);
        if (a > b.a) b = { cx: x, cy: y, a };
      }
    }
    return b;
  };

  /*
   * ABWECHSELND, NICHT GEMEINSAM.
   *
   * Über Mitte und Radius zugleich zu suchen war der erste Versuch, und er
   * verschlechterte den Durchmesser: die Kantenantwort lässt sich auch dadurch
   * verbessern, dass der Kreis kleiner UND die Mitte verschoben wird — an
   * Frame 40 kam dabei 0,2133 statt der von Hand gemessenen 0,2231 heraus,
   * während die Mitte besser wurde. Zwei Größen, die gegeneinander eintauschbar
   * sind, gehören nicht in dieselbe Suche.
   *
   * Abwechselnd verfeinert kommt jeder Schritt aus einer Frage: „wo ist die
   * Mitte, wenn der Radius steht" und „wie groß ist der Radius, wenn die Mitte
   * steht".
   */
  let cx = cx0, cy = cy0;
  let R = radiusSuchen(cx, cy, rMitte, rMitte * 1.35, Math.max(0.25, rMitte * 0.012)).R;
  for (const spanne of [Math.max(2, rMitte * 0.10), Math.max(1, rMitte * 0.04)]) {
    const m = mitteSuchen(R, cx, cy, spanne);
    cx = m.cx; cy = m.cy;
    const s = Math.max(0.25, rMitte * 0.03);
    R = radiusSuchen(cx, cy, R - s * 3, R + s * 3, s).R;
  }
  return { R, cx, cy, a: kantenAntwort(bild, cx, cy, R) };
}

/**
 * Misst den Ring in einem Bild.
 *
 * @param {Buffer|string} quelle  Pfad oder Puffer eines Einzelbildes.
 * @param {{cx:number, cy:number, d:number}=} vorher  Das Ergebnis des
 *   vorigen Frames. Ist es da, wird nur in seiner Nähe gesucht.
 * @returns {Promise<{cx:number, cy:number, d:number, antwort:number}>}
 *   Mitte als Anteil der Bildbreite bzw. -höhe, Durchmesser als Anteil der
 *   BILDBREITE.
 */
export async function ringMessen(quelle, vorher) {
  const bild = await grau(quelle);
  const { b, h } = bild;

  let best;
  if (vorher) {
    /*
     * Verfolgen — und zwar in einem Fenster, das die Physik der Fahrt abbildet.
     *
     * DAS FENSTER IST DIE EIGENTLICHE MESSUNG. Mit einem weiten Radiusfenster
     * (±16 %) rastete der Detektor ab Frame 66 auf die sonnenbeschienene
     * SICHEL IM RING um: ein heller Fleck mit dunklem Rand daneben, der
     * dieselbe Form hat, nur halb so groß. Gemessen wurde dann 0,047 statt
     * 0,101 — kein Absturz, keine Warnung, nur eine falsche Zahl.
     *
     * Die Fahrt schrumpft den Ring um 2,8 % je Frame (0,4673 auf 0,0294 über
     * 99 Frames). Ein Fenster von 0,93 bis 1,01 umschließt das mit Reserve und
     * schließt einen Halbierungssprung aus. Nach oben die 1,01 gegen
     * Messrauschen, nicht weiter: die Kamera fährt nur zurück.
     */
    // Verfolgt wird die MITTELLINIE — sie ist die stabile Größe. Die Kante
    // wird in jedem Frame frisch aus ihr abgeleitet und kann deshalb nicht
    // über hundert Frames wegdriften.
    const r0 = ((vorher.mittellinie ?? vorher.d) * b) / 2;
    const mitte = r0 * 0.97;
    best = suchen(bild, vorher.cx * b, vorher.cy * h, mitte, Math.max(3, r0 * 0.08), r0 * 0.04, 6);
  } else {
    // Breit suchen: über die ganze Fläche und über eine Größenordnung Radius.
    let grob = { a: -Infinity };
    for (let r = b * 0.05; r <= b * 0.42; r *= 1.18) {
      const k = suchen(bild, b / 2, h / 2, r, b * 0.34, r * 0.1, 8);
      if (k.a > grob.a) grob = k;
    }
    best = grob;
  }
  // Zwei Schritte, zwei Fragen: der Kranz sagt, WO der Ring ist, die Kante
  // sagt, WIE GROSS er ist. Beides in einem Detektor zu suchen hieße, einen
  // Kompromiss zwischen zwei Maxima zu finden, die nicht am selben Ort liegen.
  const kante = kanteSuchen(bild, best.cx, best.cy, best.r);
  return {
    cx: kante.cx / b,
    cy: kante.cy / h,
    /** Die Mittellinie des Körpers. Die stabile Größe — hieran wird verfolgt. */
    mittellinie: (2 * best.r) / b,
    /**
     * Die Außenkante, in diesem Frame einzeln gesucht.
     *
     * NICHT DIREKT VERWENDEN. Diese Zahl rauscht: über die Rückfahrt schwankt
     * ihr Verhältnis zur Mittellinie zwischen 1,084 und 1,132, weil das
     * Maximum der Kantenantwort flach ist und Sandkräusel es verschieben. Der
     * Aufrufer bildet den Median über viele Frames und rechnet daraus einen
     * Faktor — die Körperdicke ist eine Eigenschaft des Tieres und ändert sich
     * über eine reine Zoomfahrt nicht. Siehe `sequenz-bauen.mjs`.
     */
    kanteRoh: (2 * kante.R) / b,
    antwort: best.a,
  };
}

/* ————————————————————————— Als Befehl ————————————————————————— */

if (import.meta.url === `file://${process.argv[1]}`) {
  let vorher = null;
  for (const datei of process.argv.slice(2)) {
    const r = await ringMessen(datei, vorher);
    console.log(
      datei.split("/").pop().padEnd(16),
      `cx ${r.cx.toFixed(3)}  cy ${r.cy.toFixed(3)}  d ${r.d.toFixed(3)}  Antwort ${r.antwort.toFixed(1)}`,
    );
    // Als Befehl NICHT verfolgen: so lässt sich die Breitsuche einzeln prüfen.
    vorher = null;
  }
}
