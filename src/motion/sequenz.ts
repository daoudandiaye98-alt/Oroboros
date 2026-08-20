/**
 * Die Bildsequenz — Bewegung, die am Scroll hängt statt an der Uhr.
 *
 * WARUM KEIN `<video>`. Ein Video-Element ist für Wiedergabe gebaut, nicht für
 * Aufsuchen. `currentTime` zu setzen heißt: zum nächsten Keyframe springen,
 * dorthin dekodieren, ausgeben — je Bild, in beide Richtungen. Rückwärts ist
 * das der teuerste Fall überhaupt, weil jeder Schritt beim vorigen Keyframe
 * neu ansetzt. Das Ergebnis ruckelt, und woran es liegt, sieht man dem Code
 * nicht an. Eine Bildsequenz hat keinen Dekoderzustand: Frame 41 kostet
 * genauso viel wie Frame 3, vorwärts wie rückwärts. Es ist dieselbe Technik,
 * mit der Apple seine Produktseiten baut.
 *
 * Geladen wird über `new Image()`, NICHT über `<img>` im DOM: hundert Knoten
 * anzulegen, die nie gezeigt werden, kostet Layout und Speicher für nichts.
 */

export interface Sequenz {
  /** Wie viele Frames insgesamt. */
  anzahl: number;
  /** Wie viele davon schon da sind. */
  fertig: number;
  /** Alle Frames geladen? */
  bereit: boolean;
  /** Die geladenen Bilder, Index 0 … anzahl-1. */
  bilder: (HTMLImageElement | null)[];
}

/**
 * Der Nachschub in voller Auflösung.
 *
 * Er ersetzt die Bilder EINZELN im selben Array, während gescrollt wird. Wer
 * gerade Frame 30 sieht, sieht ihn scharf werden, sobald er da ist; die
 * Bewegung stockt dabei nicht, weil nie auf etwas gewartet wird. Das ist der
 * ganze Zweck der Stufung: die Freigabe hängt am kleinen Satz, die Schärfe am
 * großen, und beide Fragen bekommen ihre eigene Antwort.
 */
export interface NachschubOptionen {
  /** Wird gerufen, wenn ein Frame durch seine scharfe Fassung ersetzt wurde. */
  beiErsatz?: (fertig: number, von: number) => void;
}

/**
 * Lädt die volle Auflösung nach und tauscht sie einzeln ein.
 *
 * Der Reihe nach, nicht alle auf einmal: hundert gleichzeitige Anfragen
 * konkurrieren um dieselbe Leitung und kommen am Ende alle später an. Ein
 * kleines Fenster gleichzeitiger Anfragen hält die Leitung voll, ohne sie zu
 * verstopfen — und die frühen Frames sind zuerst scharf, also genau die, die
 * zuerst gesehen werden.
 */
export function ladeNachschub(
  name: string, seq: Sequenz, opts: NachschubOptionen = {},
): () => void {
  const FENSTER = 6;
  let naechster = 0;
  let ersetzt = 0;
  let abgebrochen = false;

  const eines = () => {
    if (abgebrochen || naechster >= seq.anzahl) return;
    const i = naechster++;
    const bild = new Image();
    bild.decoding = "async";
    const weiter = () => {
      ersetzt++;
      opts.beiErsatz?.(ersetzt, seq.anzahl);
      eines();
    };
    bild.onload = () => {
      if (!abgebrochen) seq.bilder[i] = bild;
      weiter();
    };
    // Ein einzelnes fehlgeschlagenes Bild ist kein Grund aufzuhören: der
    // Vorlauf-Frame bleibt stehen, und der Rest wird trotzdem scharf.
    bild.onerror = weiter;
    bild.src = frameAdresse(name, i);
  };

  for (let n = 0; n < FENSTER; n++) eines();
  return () => { abgebrochen = true; };
}

export interface LadeOptionen {
  /** Wird bei jedem angekommenen Frame gerufen — für den Ladering. */
  beiFortschritt?: (anteil: number) => void;
  /** Wird genau einmal gerufen, wenn alle Frames da sind. */
  beiFertig?: () => void;
}

/**
 * Der Pfad eines Frames.
 *
 * Die Nummerierung kommt aus ffmpeg (`f%03d.png`), beginnt also bei 1 und ist
 * dreistellig aufgefüllt. Sie hier nachzubilden statt eine Liste zu pflegen
 * hält die Datei kurz und die Wahrheit an einer Stelle: dem Dateinamen.
 */
export function frameAdresse(name: string, index: number): string {
  return `/seq/${name}/f${String(index + 1).padStart(3, "0")}.webp`;
}

/**
 * Lädt eine ganze Sequenz.
 *
 * Es wird IMMER vollständig geladen, bevor die Bühne freigegeben wird. Eine
 * halb geladene Sequenz zeigt Lücken, und eine Lücke sieht aus wie ein Fehler,
 * nicht wie ein Ladezustand.
 *
 * Ein einzelnes fehlgeschlagenes Bild hält die Sequenz nicht auf — es bleibt
 * `null`, und der Zeichner behält beim Zeichnen den letzten gültigen Frame.
 * Ein Loch im Netz darf keine leere Fläche erzeugen.
 */
export function ladeSequenz(name: string, anzahl: number, opts: LadeOptionen = {}): Sequenz {
  const seq: Sequenz = { anzahl, fertig: 0, bereit: false, bilder: new Array(anzahl).fill(null) };

  const angekommen = () => {
    seq.fertig++;
    opts.beiFortschritt?.(seq.fertig / anzahl);
    if (seq.fertig >= anzahl && !seq.bereit) {
      seq.bereit = true;
      opts.beiFertig?.();
    }
  };

  for (let i = 0; i < anzahl; i++) {
    const bild = new Image();
    bild.decoding = "async";
    bild.onload = () => { seq.bilder[i] = bild; angekommen(); };
    bild.onerror = angekommen;
    bild.src = frameAdresse(name, i);
  }
  return seq;
}

/**
 * Lädt den Vorlauf: jeden `schritt`-ten Frame, und füllt die Lücken.
 *
 * Das Ergebnis ist ein VOLLSTÄNDIGES Array — jeder der `anzahl` Plätze trägt
 * ein Bild, die dazwischenliegenden nur eben dasselbe wie ihr Vorgänger. Damit
 * ist die Zusage „nichts ist scrollbar, bevor alles geladen ist" gehalten,
 * ohne dass alles geladen sein muss: es gibt keinen leeren Platz, an dem die
 * Bewegung stocken könnte. Die Zwischenframes werden später vom Nachschub
 * einzeln durch ihre eigenen ersetzt.
 */
export function ladeVorlauf(
  name: string, anzahl: number, schritt: number, opts: LadeOptionen = {},
): Sequenz {
  const stuetzen: number[] = [];
  for (let i = 0; i < anzahl; i += schritt) stuetzen.push(i);
  const seq: Sequenz = { anzahl, fertig: 0, bereit: false, bilder: new Array(anzahl).fill(null) };
  let da = 0;

  const angekommen = () => {
    da++;
    opts.beiFortschritt?.(da / stuetzen.length);
    if (da < stuetzen.length || seq.bereit) return;
    // Alle Stützen da: die Lücken mit der jeweils letzten Stütze füllen.
    let letzte: HTMLImageElement | null = null;
    for (let i = 0; i < anzahl; i++) {
      if (seq.bilder[i]) letzte = seq.bilder[i];
      else seq.bilder[i] = letzte;
    }
    seq.fertig = anzahl;
    seq.bereit = true;
    opts.beiFertig?.();
  };

  stuetzen.forEach((i, n) => {
    const bild = new Image();
    bild.decoding = "async";
    bild.onload = () => { seq.bilder[i] = bild; angekommen(); };
    bild.onerror = angekommen;
    // Der Vorlauf ist eigenständig durchnummeriert: sein n-ter Frame ist der
    // (n * schritt)-te der vollen Stufe.
    bild.src = frameAdresse(name, n);
  });
  return seq;
}

/* ————————————————————————————— Zeichnen ————————————————————————————— */

/**
 * Setzt die Pixelgröße des Canvas auf die Anzeigegröße mal Gerätedichte.
 *
 * Gedeckelt auf 2: auf einem Telefon mit Faktor 3 wären es 9-mal so viele
 * Bildpunkte wie im CSS-Kasten, und das kostet je Frame spürbar Zeit, ohne
 * dass es jemand sieht — die Quelle hat diese Auflösung ohnehin nicht.
 *
 * Gibt `false` zurück, wenn sich nichts geändert hat; der Aufrufer spart sich
 * dann das Neuzeichnen.
 */
export function canvasSpannen(canvas: HTMLCanvasElement, quelle?: HTMLImageElement | null): boolean {
  let dichte = Math.min(window.devicePixelRatio || 1, 2);
  /*
   * Der Canvas wird nie größer aufgespannt, als die Quelle ihn füllen kann.
   *
   * Ein 1284 px breiter Frame auf einen 2880 px breiten Canvas zu zeichnen
   * heißt: die Grafikkarte interpoliert 2880 Spalten aus 1284. Genau dasselbe
   * täte der Browser danach beim Verkleinern auf die CSS-Größe — nur zweimal
   * und teurer. Wird der Canvas stattdessen auf die Auflösung der Quelle
   * begrenzt, gibt es genau eine Skalierung, sie passiert im Compositor, und
   * jedes gezeichnete Bildpunkt entspricht einem echten Bildpunkt der Quelle.
   *
   * Das macht das Bild NICHT schärfer, als die Quelle ist — dafür braucht es
   * größere Quellen. Es verhindert nur, dass zweimal interpoliert wird.
   */
  if (quelle && quelle.naturalWidth > 0) {
    /*
     * MINIMUM der beiden Achsen, nicht Maximum.
     *
     * Damit `cover` nicht hochskaliert, muss die Quelle BEIDE Achsen decken:
     * Canvasbreite ≤ Quellbreite UND Canvashöhe ≤ Quellhöhe. Die bindende
     * Achse ist also die knappere — mit `max` erlaubte der Deckel eine
     * Dichte, die die andere Achse nicht tragen konnte. Gemessen auf
     * 390 × 844: Deckel gab 2,0 frei, der Canvas wurde 780 × 1688, und das
     * 828 × 1108 große Bild musste um 1,52 gedehnt werden.
     *
     * Der Boden bei 1 bleibt: unter die CSS-Auflösung wird nie gegangen. Das
     * würde die Vergrößerung nur vom Canvas in den Compositor verschieben und
     * die Messzahl schönen, ohne ein einziges Detail zu gewinnen.
     */
    const passt = Math.min(
      quelle.naturalWidth / Math.max(1, canvas.clientWidth),
      quelle.naturalHeight / Math.max(1, canvas.clientHeight),
    );
    dichte = Math.min(dichte, Math.max(1, passt));
  }
  const b = Math.round(canvas.clientWidth * dichte);
  const h = Math.round(canvas.clientHeight * dichte);
  if (b < 1 || h < 1) return false;
  if (canvas.width === b && canvas.height === h) return false;
  canvas.width = b;
  canvas.height = h;
  return true;
}

/**
 * Zeichnet einen Frame formatfüllend — dasselbe wie `object-fit: cover`.
 *
 * Die Rechnung steht hier und nicht im CSS, weil ein Canvas seinen Inhalt
 * nicht kennt: `object-fit` wirkt auf das Element, nicht auf das, was
 * hineingemalt wird. Ohne diese vier Zeilen wäre jedes Bild verzerrt.
 */
export function zeichneDeckend(
  canvas: HTMLCanvasElement, bild: HTMLImageElement, schwenkX = 0,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cb = canvas.width;
  const ch = canvas.height;
  const massstab = Math.max(cb / bild.naturalWidth, ch / bild.naturalHeight);
  const b = bild.naturalWidth * massstab;
  const h = bild.naturalHeight * massstab;
  /*
   * Der Schwenk kommt in CSS-Bildpunkten und wird hier in Canvas-Bildpunkte
   * umgerechnet. Die beiden sind bei Gerätedichte 2 nicht dasselbe, und ein
   * ungerechneter Schwenk wäre auf dem Telefon doppelt so weit wie gemeint.
   *
   * ER WIRD NICHT GEKLEMMT. Wer ihn setzt, hat vorher gegen den Overscan
   * gerechnet (`kamera.ts`); ein Klemmen hier würde einen Rechenfehler dort
   * still verschlucken, statt ihn sichtbar zu machen.
   */
  const inCanvas = schwenkX * (cb / Math.max(1, canvas.clientWidth));
  ctx.drawImage(bild, (cb - b) / 2 + inCanvas, (ch - h) / 2, b, h);
}

/**
 * Der Frame zu einem Fortschritt — hart gerundet.
 *
 * Für alles, was nur wissen will, WELCHES Bild gerade dran ist.
 */
export function frameZu(anteil: number, anzahl: number): number {
  if (anzahl < 1) return 0;
  return Math.max(0, Math.min(anzahl - 1, Math.round(anteil * (anzahl - 1))));
}

/**
 * Die exakte Stelle zwischen zwei Frames.
 *
 * `{ i, t }` — Frame `i` und der Bruchteil `t` zum nächsten.
 */
export function frameStelle(anteil: number, anzahl: number): { i: number; t: number } {
  if (anzahl < 2) return { i: 0, t: 0 };
  const f = Math.max(0, Math.min(anzahl - 1, anteil * (anzahl - 1)));
  const i = Math.floor(f);
  return { i, t: f - i };
}

/**
 * Zeichnet die Stelle zwischen zwei Frames, linear überblendet.
 *
 * DAS WAR LANGE VERBOTEN, UND DER GRUND IST WEGGEFALLEN. Bei 40 Frames auf
 * 520 svh lagen 110 px Scrollweg zwischen zwei Bildern; zwei so weit
 * auseinanderliegende Bilder halb übereinander ergeben Schlieren — man sieht
 * zwei Schlangen. Bei 100 Frames auf 300 svh sind es 25 px, und die
 * Nachbarbilder unterscheiden sich so wenig, dass die Blende die Stufen
 * glättet, statt Doppelbilder zu erzeugen.
 *
 * Zeigen die Aufnahmen doch Schlieren, gehört die Blende wieder aus und die
 * Framezahl hoch — nicht umgekehrt.
 */
export function zeichneStelle(
  canvas: HTMLCanvasElement, seq: Sequenz, anteil: number, blenden: boolean,
  schwenkX = 0, anzahl = seq.anzahl,
): void {
  const { i, t } = frameStelle(anteil, anzahl);
  const a = naechstesBild(seq, i);
  if (!a) return;
  zeichneDeckend(canvas, a, schwenkX);
  if (!blenden || t <= 0.001 || i + 1 >= anzahl) return;
  const b = seq.bilder[i + 1];
  if (!b || b === a) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.globalAlpha = t;
  zeichneDeckend(canvas, b, schwenkX);
  ctx.globalAlpha = 1;
}

/**
 * Der nächste vorhandene Frame ab `index`, notfalls rückwärts gesucht.
 *
 * Damit zeigt der Canvas auch dann Bild, wenn ein einzelnes Frame nicht
 * angekommen ist. „Jede Bühne zeigt zu jedem Zeitpunkt Bild" ist ein
 * Abnahmekriterium — es darf nicht davon abhängen, dass hundert Anfragen
 * alle geglückt sind.
 */
export function naechstesBild(seq: Sequenz, index: number): HTMLImageElement | null {
  for (let i = index; i >= 0; i--) if (seq.bilder[i]) return seq.bilder[i];
  for (let i = index + 1; i < seq.anzahl; i++) if (seq.bilder[i]) return seq.bilder[i];
  return null;
}

/**
 * Ein grobes Raster Farben aus einem Bild — und deren Mittel.
 *
 * ZWEI VERWENDUNGEN, EINE MESSUNG. Der Staub der Ladeszene bekommt seine
 * Farben aus dem ersten Frame, die Randfüllung des Schlussbildes ihren Ton aus
 * dem Mittel derselben Probe. Beides aus derselben Quelle zu ziehen ist nicht
 * bloß sparsam: schriebe man den Sandton irgendwo als Hexwert hin, wäre er
 * beim nächsten Farbkorrektur-Durchgang des Films still falsch — und Sand, der
 * nicht ganz zum Sand passt, sieht man sofort als Kante.
 *
 * `raster` × `raster` Proben, heruntergerechnet über einen kleinen Canvas.
 * Das Herunterrechnen mittelt bereits über die Fläche; einzelne Bildpunkte
 * abzugreifen fischte stattdessen Rauschen heraus.
 */
export interface Farbprobe {
  /** Alle Proben, je drei Werte (r, g, b) hintereinander. */
  punkte: Uint8ClampedArray;
  /** Wie viele Proben je Achse. */
  raster: number;
  /** Das Mittel über alle Proben, als CSS-Farbe. */
  mittel: string;
  /**
   * Das Mittel über den RAND der Probe, als CSS-Farbe.
   *
   * Für die Randfüllung des Schlussbildes, und zwar die RECHTE Spalte, nicht
   * der ganze Rand. Das Bild wandert am Ende nach links, damit sein Ring auf
   * den Platz des ersten O kommt; die Fläche, die dabei frei wird, liegt fast
   * vollständig rechts (auf 1440 × 900 sind es 39 % der Breite, oben und unten
   * je 6 %). Eine Füllung, die zum Mittel aller vier Kanten passt, passt damit
   * genau dort nicht, wo die Naht lang ist. Gemessen: das Flächenmittel war
   * deutlich satter als der Sand, an dem es anlag — die Naht war die
   * auffälligste Linie im Bild.
   */
  rand: string;
}

export function farbenLesen(bild: HTMLImageElement, raster = 24): Farbprobe | null {
  if (!bild.naturalWidth) return null;
  const cv = document.createElement("canvas");
  cv.width = raster;
  cv.height = raster;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bild, 0, 0, raster, raster);
  let daten: ImageData;
  try {
    daten = ctx.getImageData(0, 0, raster, raster);
  } catch {
    // Ein verunreinigter Canvas wirft hier. Die Frames kommen von derselben
    // Herkunft, also darf das nicht passieren — wenn doch, lieber keine Farbe
    // als eine Ausnahme, die die ganze Ladeszene mitnimmt.
    return null;
  }
  const punkte = new Uint8ClampedArray(raster * raster * 3);
  let sr = 0, sg = 0, sb = 0;
  let kr = 0, kg = 0, kb = 0, kn = 0;
  for (let i = 0; i < raster * raster; i++) {
    const r = daten.data[i * 4], g = daten.data[i * 4 + 1], b = daten.data[i * 4 + 2];
    punkte[i * 3] = r; punkte[i * 3 + 1] = g; punkte[i * 3 + 2] = b;
    sr += r; sg += g; sb += b;
    if (i % raster === raster - 1) { kr += r; kg += g; kb += b; kn++; }
  }
  const n = raster * raster;
  const farbe = (r: number, g: number, b: number, teiler: number) =>
    `rgb(${Math.round(r / teiler)}, ${Math.round(g / teiler)}, ${Math.round(b / teiler)})`;
  return {
    punkte,
    raster,
    mittel: farbe(sr, sg, sb, n),
    rand: farbe(kr, kg, kb, Math.max(1, kn)),
  };
}
