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
export function canvasSpannen(canvas: HTMLCanvasElement): boolean {
  const dichte = Math.min(window.devicePixelRatio || 1, 2);
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
export function zeichneDeckend(canvas: HTMLCanvasElement, bild: HTMLImageElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cb = canvas.width;
  const ch = canvas.height;
  const massstab = Math.max(cb / bild.naturalWidth, ch / bild.naturalHeight);
  const b = bild.naturalWidth * massstab;
  const h = bild.naturalHeight * massstab;
  ctx.drawImage(bild, (cb - b) / 2, (ch - h) / 2, b, h);
}

/**
 * Der Frame zu einem Fortschritt — HART gerundet, nie überblendet.
 *
 * Zwischen zwei Frames zu blenden erzeugt bei großen Bildsprüngen Schlieren:
 * man sieht zwei Schlangen gleichzeitig, halbdurchsichtig. Die Weichheit muss
 * aus dem Nachzug der Rollposition kommen, nicht aus Alpha.
 */
export function frameZu(anteil: number, anzahl: number): number {
  if (anzahl < 1) return 0;
  return Math.max(0, Math.min(anzahl - 1, Math.round(anteil * (anzahl - 1))));
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
