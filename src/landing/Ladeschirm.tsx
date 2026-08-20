/**
 * Die Ladeszene — und der Übergang in den Film.
 *
 * ERSTENS: NICHTS IST SCROLLBAR, BEVOR DIE FRAMES DA SIND. Eine Sequenz, der
 * Frames fehlen, springt beim Scrollen — und ein Sprung sieht aus wie ein
 * Fehler, nicht wie ein Ladezustand.
 *
 * ZWEITENS: DIE WARTEZEIT GEHÖRT ZUR SEITE. Der Ouroboros zeichnet sich, ein
 * Satz steht darunter, und wenn die Frames da sind, zerfällt die Linie zu
 * Staub, der sich zum ersten Bild des Films setzt.
 *
 * ————————————————————————————————————————————————————————————————————————
 * WARUM DAS UMGEBAUT WURDE: ES WAR EIN SCHNITT, KEIN ÜBERGANG
 * ————————————————————————————————————————————————————————————————————————
 *
 * Die erste Fassung hatte den Staub auf `--tief` liegen (#0E0A06) und das
 * Bild darunter mit `globalAlpha` aufgeblendet. Zwei Fehler, beide
 * architektonisch:
 *
 *   1. Der Grund blieb fast schwarz, bis der Film erschien. Frame 0 ist heller
 *      Sand (Mittel etwa 169 von 255). Ein Wechsel von Fast-Schwarz zu Sand IST
 *      ein Schnitt, ganz gleich, wie gut die Partikel aussehen.
 *   2. Eine flächige Deckkraftrampe auf dem ganzen Bild ist eine Kreuzblende.
 *      Zwei Zustände, die übereinander liegen und getauscht werden — genau das,
 *      was ein Übergang nicht sein soll.
 *
 * Jetzt treibt EINE geteilte Größe alles: `dichte`, von 0 bis 1.
 *
 *   · Die Grundfarbe wandert mit ihr von `--tief` zum Mittel von Frame 0. Bei
 *     voller Dichte ist der Grund bereits Sand — es gibt keinen Sprung mehr,
 *     weil es nichts mehr zu springen gibt.
 *   · Das Bild wird nicht aufgeblendet, sondern durch eine RAUSCHMASKE
 *     sichtbar, deren Schwelle der örtlichen Partikeldichte folgt. Wo Staub
 *     dicht steht, ist das Bild schon da. Umgesetzt über ein kleines
 *     Maskenbild (ein Sechstel der Auflösung) und `destination-in`.
 *   · Die Partikel zielen über die GANZE Fläche, nicht auf eine Scheibe in der
 *     Mitte. Der Wirbel bleibt als Bewegungsform, aber er trägt nach außen.
 *
 * Und es endet nicht: wenn die Maske offen ist, laufen die letzten Körner noch
 * 600 ms als Flugsand über das Bild weiter.
 *
 * DIE SECHS SCHLÄGE.
 *   A zerfall   Die Linie bricht auf. Der Staub steht noch, wo sie stand.
 *   B trift     Er treibt auseinander, über den ganzen Rahmen hinaus.
 *   C fall      Er fällt und wird langsamer, wie Sand, der sich legt.
 *   D setzen    Er ordnet sich; Grund und Maske öffnen das Bild darunter.
 *   E uebergabe Die Maske ist offen, der Staub dünnt aus.
 *   F flugsand  Was übrig ist, weht über die Düne und verschwindet.
 *
 * Die Dauern stehen in `bewegung.css`, nicht hier — auch diese sechs.
 */
import { useEffect, useRef, useState } from "react";
import { dauer } from "../motion/tokens";
import type { Farbprobe } from "../motion/sequenz";

/** Wie viele Körner. Am oberen Ende dessen, was ein Telefon je Bild schafft. */
const KOERNER = 3200;

/**
 * Auf welchen Bruchteil der Fläche die Maske gerechnet wird.
 *
 * DREI, NICHT ACHT — und das ist eine Sichtprüfung, keine Rechnung. Bei acht
 * ist eine Maskenzelle acht Bildpunkte breit, und weil die Schwelle hart ist,
 * schaltet sie als Ganzes. In der Aufnahme bei 2700 ms war das ein grobes
 * Rechteckraster über der Düne: es sah nach Dateiformat aus, nicht nach Sand.
 * Kein Messwert hat das gemeldet — Helligkeit, Bildrate und Kantentextur waren
 * alle im grünen Bereich.
 *
 * Bei drei sind es 480 × 300 Zellen auf 1440 × 900. Das kostet je Bild etwa
 * 144 000 Durchläufe für das Maskenbild; gemessen bleibt die Bildrate über
 * fünfzig. Feiner geht auch, aber dann konkurriert die Körnung mit der
 * Sandkörnung des Films selbst.
 */
const MASKE_TEILER = 3;

/** Die sechs Schläge, in ihrer Reihenfolge, mit dem Namen ihres Tokens. */
const SCHLAEGE = [
  { name: "zerfall", token: "--schlag-a" },
  { name: "trift", token: "--schlag-b" },
  { name: "fall", token: "--schlag-c" },
  { name: "setzen", token: "--schlag-d" },
  { name: "uebergabe", token: "--schlag-e" },
  { name: "flugsand", token: "--schlag-f" },
] as const;

export interface LadeschirmEigenschaften {
  /** Sind die Frames da? */
  bereit: boolean;
  /** Die Farbprobe aus dem ERSTEN Frame — Quelle der Staubfarben. */
  farben: Farbprobe | null;
  /** Frame 0 selbst. Er wird im Übergang schon gezeichnet, nicht erst danach. */
  erstes: HTMLImageElement | null;
  /**
   * Der Canvas, auf dem der Staub liegt — er gehört der BÜHNE, nicht dieser
   * Szene.
   *
   * Er lag bis eben in dieser Komponente, also in einer festen Ebene ÜBER dem
   * Schleier der Bühne. In dem Moment, in dem die Ladeszene ausgehängt wurde,
   * legte sich der Schleier schlagartig über das Bild — seine untere Kante ist
   * zu 88 % schwarz. Gemessen war das ein Helligkeitssprung von 41 bis 47 von
   * 255 in einem einzigen Schritt: genau der Schnitt, den dieser Auftrag
   * abstellen soll, nur an einer anderen Stelle als der, wo man ihn vermutete.
   *
   * Jetzt liegt der Staub UNTER dem Schleier, in derselben Ebenenordnung wie
   * der Film. Damit gilt für ihn dieselbe Abdunklung wie für das Bild danach,
   * durchgehend, und es gibt bei der Übergabe nichts mehr umzuschalten.
   */
  staub: React.RefObject<HTMLCanvasElement | null>;
  /** Ruhemodus: kein Staub, nur halten und blenden. */
  ruhig: boolean;
  /** Gerufen, wenn der Übergang durch ist und die Seite gehört. */
  beiUebergabe: () => void;
}

const klemm = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function Ladeschirm({
  bereit, farben, erstes, staub, ruhig, beiUebergabe,
}: LadeschirmEigenschaften) {
  const marke = useRef<SVGSVGElement>(null);
  const [zug, setZug] = useState(false);
  const [zerfallen, setZerfallen] = useState(false);
  const [weg, setWeg] = useState(false);
  /** Wann der Zug begonnen hat — der Staub darf ihn nicht abschneiden. */
  const begonnen = useRef(0);

  /*
   * Der Zug beginnt im nächsten Bild, nicht sofort. Ein Übergang zündet nur,
   * wenn der Browser den Anfangswert einmal gesehen hat.
   */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      begonnen.current = performance.now();
      setZug(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /* ————————————————————————— Der ruhige Pfad ————————————————————————— */

  useEffect(() => {
    if (!ruhig || !bereit) return;
    const zeit = dauer("--ruhe-halt") + dauer("--ruhe-blende");
    const id = window.setTimeout(() => { setWeg(true); beiUebergabe(); }, zeit);
    return () => window.clearTimeout(id);
  }, [ruhig, bereit, beiUebergabe]);

  /* ————————————————————————— Der Übergang ————————————————————————— */

  useEffect(() => {
    if (ruhig || !bereit) return;
    const cv = staub.current;
    if (!cv) return;
    const cvAnfang = cv;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const takte = SCHLAEGE.map((s) => dauer(s.token));
    const gesamt = takte.reduce((a, b) => a + b, 0);
    /* Erst zeichnen, dann zerfallen. Sind die Frames vor dem Ende des Zuges
       da, wartet der Staub — sonst risse er der Marke den Stift aus der Hand. */
    const rest = Math.max(0, dauer("--zeichnen-marke") - (performance.now() - begonnen.current));

    let laeuft = true;
    let id = 0;
    const starten = () => {
      /*
       * Die Auflösung des Übergangs ist gedeckelt — gemessen, nicht gespart.
       *
       * Der Übergang zeichnet je Bild drei ganzflächige Schritte: Bild in den
       * Puffer, Maske darauf, Puffer auf den Schirm. Bei Gerätedichte 2 sind
       * das auf 1440 × 900 dreimal 5,2 Megapixel. Der Staub selbst ist dagegen
       * billig. Auf 1440 × 900 lag die Bildrate bei 35 je Sekunde, bei
       * geforderten 45; nach dem ersten Deckel bei Der Deckel auf eine Million Bildpunkte bringt sie über
       * 41, mit dem Deckel auf 0,7 Millionen bei 40 bis 55 — von Lauf zu Lauf
       * schwankend, also ohne Reserve. Bei 0,45 Millionen liegt sie stabil
       * darüber.
       * Die Bildrate ist hier das wichtigere Gut: der Übergang ist
       * eine Bewegung, und eine Bewegung, die stockt, ist kaputt — die Schärfe
       * eines Zustands, den man Sekundenbruchteile sieht, ist es nicht.
       */
      const flaeche = Math.max(1, cvAnfang.clientWidth * cvAnfang.clientHeight);
      const dichteGeraet = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(0.45e6 / flaeche));
      let bb = 0, bh = 0, cb = 0, ch = 0;

      const puffer = document.createElement("canvas");
      const pctx = puffer.getContext("2d");
      const maske = document.createElement("canvas");
      const mctx = maske.getContext("2d", { willReadFrequently: true });
      let mb = 0, mh = 0;
      let rauschen = new Float32Array(0);
      let feld = new Float32Array(0);
      let maskenBild: ImageData | null = null;

      const spannen = () => {
        bb = cv.clientWidth; bh = cv.clientHeight;
        cb = Math.round(bb * dichteGeraet); ch = Math.round(bh * dichteGeraet);
        cv.width = cb; cv.height = ch;
        puffer.width = cb; puffer.height = ch;
        mb = Math.max(2, Math.ceil(bb / MASKE_TEILER));
        mh = Math.max(2, Math.ceil(bh / MASKE_TEILER));
        maske.width = mb; maske.height = mh;
        rauschen = new Float32Array(mb * mh);
        for (let i = 0; i < rauschen.length; i++) rauschen[i] = Math.random();
        feld = new Float32Array(mb * mh);
        maskenBild = mctx ? mctx.createImageData(mb, mh) : null;
      };
      spannen();

      /*
       * Die Körner. Ein `Float32Array` je Größe statt dreitausend Objekte: die
       * Schleife läuft sechzigmal je Sekunde über alle.
       *
       * `zx`/`zy` ist das ZIEL, und es liegt über die GANZE Fläche verteilt —
       * nicht auf einer Scheibe in der Mitte, wie in der ersten Fassung. Farbe
       * und Ziel kommen aus derselben Probe von Frame 0: das Kornfeld ist am
       * Ende von Schlag D buchstäblich eine grobe Fassung des Bildes, das
       * darunter aufgeht.
       */
      const x = new Float32Array(KOERNER), y = new Float32Array(KOERNER);
      const vx = new Float32Array(KOERNER), vy = new Float32Array(KOERNER);
      const zx = new Float32Array(KOERNER), zy = new Float32Array(KOERNER);
      const gr = new Float32Array(KOERNER), tempo = new Float32Array(KOERNER);
      const farbe: string[] = new Array(KOERNER);

      const raster = farben?.raster ?? 0;
      const deck = raster > 0 ? Math.max(bb / raster, bh / raster) : 0;
      const rx = (bb - raster * deck) / 2, ry = (bh - raster * deck) / 2;

      const mk = marke.current?.getBoundingClientRect();
      const mx = mk ? mk.left + mk.width / 2 : bb / 2;
      const my = mk ? mk.top + mk.height / 2 : bh / 2;
      const radius = (mk ? mk.width : 80) * 0.425;

      for (let i = 0; i < KOERNER; i++) {
        const w = (i / KOERNER) * Math.PI * 2;
        const streu = 0.9 + Math.random() * 0.2;
        x[i] = mx + Math.cos(w) * radius * streu;
        y[i] = my + Math.sin(w) * radius * streu;
        vx[i] = 0; vy[i] = 0;
        gr[i] = 0.7 + Math.random() * 1.8;
        tempo[i] = 0.45 + Math.random() * 1.25;
        if (raster > 0 && farben) {
          const z = i % (raster * raster);
          const sx = z % raster, sy = Math.floor(z / raster);
          zx[i] = rx + (sx + Math.random()) * deck;
          zy[i] = ry + (sy + Math.random()) * deck;
          const q = z * 3;
          farbe[i] = `rgb(${farben.punkte[q]},${farben.punkte[q + 1]},${farben.punkte[q + 2]})`;
        } else {
          zx[i] = Math.random() * bb; zy[i] = Math.random() * bh;
          farbe[i] = "#F4EDE2";
        }
      }

      // Die beiden Enden der Grundfarbe. Das helle kommt aus dem Bild, nicht
      // aus einem Hexwert — sonst passte es beim nächsten Farbdurchgang nicht.
      const tief = [14, 10, 6];
      const sand = farben
        ? (farben.mittel.match(/\d+/g) ?? ["169", "140", "100"]).map(Number)
        : [169, 140, 100];

      const auf = performance.now();
      let voriges = auf;
      const bild = (jetzt: number) => {
        if (!laeuft) return;
        const dt = Math.min(0.05, (jetzt - voriges) / 1000);
        voriges = jetzt;
        const abgelaufen = jetzt - auf;

        let k = 0, rand = 0;
        while (k < takte.length - 1 && abgelaufen > rand + takte[k]) { rand += takte[k]; k++; }
        const t = klemm((abgelaufen - rand) / Math.max(1, takte[k]));
        const name = SCHLAEGE[k].name;
        if (k > 0) setZerfallen(true);

        /*
         * DIE EINE GETEILTE GRÖSSE — und warum sie über DREI Schläge läuft.
         *
         * `dichte` treibt alles: die Grundfarbe, die Maske, das Ausdünnen des
         * Staubs. Zwei getrennte Zeitachsen hätten wieder ein Umschalten
         * ergeben, egal wie gut die Kurven sind.
         *
         * Sie stieg zuerst nur über Schlag D, also über 900 ms. Das war
         * arithmetisch unmöglich: der Grund muss von 11 auf 169 von 255, das
         * sind 158 Stufen. Über 900 ms verteilt sind das 21 Stufen je 120 ms —
         * fast doppelt so viel wie die zwölf, die noch als stetig gelten. Kein
         * Easing repariert das; die Strecke ist zu kurz für den Weg.
         *
         * Über C, D und E zusammen sind es 2700 ms, also im Mittel 7 Stufen je
         * 120 ms. Die Glättung unten hebt die steilste Stelle auf das
         * Anderthalbfache, macht 10,5 — unter zwölf, mit Reserve.
         */
        /*
         * Von B bis E, nicht von C bis E.
         *
         * Über C+D+E (2700 ms) blieb die gemessene Rate bei 14 bis 16,7 Stufen
         * je 120 ms — der Weg von 118 Stufen ist zu lang für die Strecke,
         * sobald die Rate nicht vollkommen gleichmäßig ist, und vollkommen
         * gleichmäßig wird sie nie: Grundfarbe und Maske addieren sich.
         * Über B+C+D+E sind es 3600 ms, also im Mittel 3,9.
         *
         * Dass der Grund schon während des Auseinandertreibens heller wird,
         * ist kein Zugeständnis: die Welt hellt auf, während der Staub sich
         * verteilt. Es sieht nach Morgen aus, nicht nach einer Blende.
         */
        const cAnfang = takte[0];
        const cbisE = takte[1] + takte[2] + takte[3] + takte[4];
        /*
         * LINEAR, nicht geglättet.
         *
         * Eine Glättung (`x²(3−2x)`) sieht an einem Regler schöner aus, aber
         * sie macht die Mitte anderthalbmal so steil wie den Schnitt — und
         * genau die Mitte ist hier die gemessene Größe. Gemessen: 18,2 Stufen
         * je 120 ms mit Glättung, wo zwölf die Grenze sind. Was hier zählt,
         * ist eine gleichmäßige Änderungsrate; die bekommt man nur linear.
         */
        const dichte = klemm((abgelaufen - cAnfang) / cbisE);

        if (bb !== cv.clientWidth || bh !== cv.clientHeight) spannen();

        /* ————— Der Grund wandert mit ————— */
        const g = (i: number) => Math.round(tief[i] + (sand[i] - tief[i]) * dichte);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgb(${g(0)},${g(1)},${g(2)})`;
        ctx.fillRect(0, 0, cb, ch);
        ctx.setTransform(dichteGeraet, 0, 0, dichteGeraet, 0, 0);

        /* ————— Die Körner bewegen ————— */
        for (let i = 0; i < KOERNER; i++) {
          switch (name) {
            case "zerfall": {
              const w = Math.atan2(y[i] - my, x[i] - mx);
              vx[i] += Math.cos(w) * 26 * tempo[i] * dt;
              vy[i] += Math.sin(w) * 26 * tempo[i] * dt;
              break;
            }
            case "trift": {
              // Treiben: nach außen, über den Rahmen hinaus, mit Wirbel.
              const w = Math.atan2(y[i] - my, x[i] - mx);
              vx[i] += (Math.cos(w) * 260 * tempo[i] + Math.cos(i) * 90) * dt;
              vy[i] += (Math.sin(w) * 260 * tempo[i] + Math.sin(i * 1.7) * 90) * dt;
              break;
            }
            case "fall": {
              vy[i] += 210 * dt;
              vx[i] *= 1 - 1.7 * dt;
              vy[i] *= 1 - 0.7 * dt;
              break;
            }
            case "setzen": {
              const f = 1 - Math.pow(1 - 0.12, dt * 60);
              x[i] += (zx[i] - x[i]) * f;
              y[i] += (zy[i] - y[i]) * f;
              vx[i] *= 1 - 6 * dt;
              vy[i] *= 1 - 6 * dt;
              break;
            }
            case "uebergabe": {
              const f = 1 - Math.pow(1 - 0.18, dt * 60);
              x[i] += (zx[i] - x[i]) * f;
              y[i] += (zy[i] - y[i]) * f;
              break;
            }
            default: {
              // Flugsand: was übrig ist, weht über die Düne.
              vx[i] += (34 + Math.cos(i) * 16) * dt;
              vy[i] += (Math.sin(i * 2.1) * 12) * dt;
              break;
            }
          }
          x[i] += vx[i] * dt;
          y[i] += vy[i] * dt;
        }

        /* ————— Die Dichtemaske ————— */
        if (mctx && maskenBild && erstes && pctx) {
          feld.fill(0);
          for (let i = 0; i < KOERNER; i++) {
            const cxm = (x[i] / MASKE_TEILER) | 0, cym = (y[i] / MASKE_TEILER) | 0;
            if (cxm < 0 || cym < 0 || cxm >= mb || cym >= mh) continue;
            // Ein Korn deckt seine Zelle und die Nachbarn — sonst bliebe die
            // Maske ein Punktraster statt einer Fläche.
            for (let ox = -1; ox <= 1; ox++) {
              for (let oy = -1; oy <= 1; oy++) {
                const px = cxm + ox, py = cym + oy;
                if (px < 0 || py < 0 || px >= mb || py >= mh) continue;
                feld[py * mb + px] += ox === 0 && oy === 0 ? 1 : 0.45;
              }
            }
          }
          /*
           * Die Schwelle wandert mit der Dichte. Zusätzlich öffnet ein
           * gleichmäßiger Anteil `dichte²` die Fläche auch dort, wo gerade kein
           * Korn liegt — ohne ihn bliebe das Bild ein Lochmuster, und die
           * letzten Löcher schlössen sich erst, wenn alle Körner stehen.
           */
          const d = maskenBild.data;
          /*
           * LINEAR IN `dichte`, und der Faktor ist ausgerechnet.
           *
           * Zwei Fehler steckten hier nacheinander. Erst war der Faktor 1,0:
           * die Schwelle unten zieht `rauschen · 0,85` ab, also erreichten die
           * verrauschtesten Zellen nur (1 − 0,85) · 3,2 = 0,48 Deckkraft. Das
           * Bild wurde nie ganz undurchsichtig, und bei der Übergabe sprang es
           * auf volle Deckung — gemessen 46 Stufen von 255 in einem Schritt.
           *
           * Dann war es `dichte² · 1,7`: voll gedeckt, aber quadratisch, und
           * damit war die Maske schon bei `dichte ≈ 0,65` offen. Die ganze
           * Enthüllung drängte sich auf 1,3 s zusammen, obwohl ihr 2,7 s zur
           * Verfügung standen — gemessen 17,7 Stufen je 120 ms.
           *
           * `dichte · 1,85` machte es schlimmer (32,9 statt 17,7), und daran
           * ließ sich der eigentliche Zusammenhang ablesen: entscheidend ist
           * nicht die Form der Kurve, sondern WANN DIE LETZTE ZELLE AUFGEHT.
           * Die Zeile unten schärft mit dem Faktor 3,2; eine Zelle ist voll
           * gedeckt, sobald `wert ≥ rauschen · 0,85 + 1/3,2`. Im schlechtesten
           * Fall (Rauschen 1) sind das 1,1625. Bei `1,85 · dichte` ist das
           * schon bei `dichte = 0,63` erreicht — die restlichen 37 % der Zeit
           * passiert nichts mehr, und die ganze Enthüllung drängt sich in die
           * ersten 1,15 s.
           *
           * Der Faktor muss die Sättigung also GENAU auf `dichte = 1` legen.
           * Bei der harten Schwelle unten (Faktor 9) sind das 0,85 + 1/9 =
           * 0,96; hier steht 0,97, ein Hauch darüber. Dann geht die erste Zelle
           * am Anfang auf und die letzte am Ende, und der Weg von 118 Stufen
           * verteilt sich auf die vollen 2,7 s — im Mittel 5,2 je 120 ms, an
           * der steilsten Stelle der Glättung 7,9.
           */
          for (let i = 0; i < feld.length; i++) {
            /*
             * Der Kornanteil ist ein ZUSCHLAG von höchstens 0,25, kein zweiter
             * Grundwert.
             *
             * Er stand vorher als eigener Summand mit dem Gewicht 1 da. Sobald
             * sich der Staub gelegt hatte, deckte er praktisch jede Maskenzelle
             * — 3200 Körner mit 3×3-Abdruck auf 20 000 Zellen —, und der Wert
             * wurde `2,17 · dichte` statt `1,17 · dichte`. Sättigung bei
             * `dichte = 0,54`, und die Enthüllung war nach 1,5 statt 2,7
             * Sekunden vorbei.
             *
             * 0,06 und nicht mehr, und der Grund ist gemessen: der Staub
             * bedeckt nach dem Setzen praktisch JEDE Maskenzelle — auf
             * 390 × 844 sind es 5194 Zellen und 3200 Körner mit 3×3-Abdruck,
             * also im Mittel fünffache Deckung. Ein großzügiger Zuschlag gilt
             * damit nicht dort, wo Staub liegt, sondern überall; er verkürzt
             * bloß den Weg. Bei 0,25 war die Enthüllung nach 1,7 s vorbei
             * statt nach 2,7, und die Änderungsrate entsprechend zu hoch.
             *
             * Sechs Prozent Vorsprung reichen für die Körnung: sichtbar wird
             * das Bild zuerst in den dichtesten Nestern, und die Reihenfolge
             * macht das Rauschen, nicht der Betrag.
             */
            const wert = dichte * (0.97 + 0.06 * Math.min(1, feld[i] * 0.55));
            /*
             * Hart geschwellt (Faktor 9), nicht weich (3,2).
             *
             * Der Faktor bestimmt, über welche Spanne EINE Zelle aufgeht: bei
             * 3,2 sind das 0,31 in `wert`, also 27 % der ganzen Zeitachse. Die
             * Schwellen der Zellen sind über 0,85 gestreut. Beide Spannen
             * falten sich, und heraus kommt eine Öffnungsrate mit einem
             * Buckel in der Mitte — gemessen 14 Stufen je 120 ms, wo im Mittel
             * 6,3 anfielen.
             *
             * Bei 9 geht eine Zelle über 0,11 auf, also fast schlagartig. Dann
             * ist der Anteil offener Zellen so gleichmäßig verteilt wie die
             * Schwellen selbst — und die kommen aus `Math.random`, sind also
             * gleichverteilt. Die Rate wird flach.
             *
             * Nebenbei ist es das bessere Bild: eine harte Schwelle auf
             * Rauschen ist Körnung, eine weiche ist Weichzeichnung.
             */
            const a = klemm((wert - rauschen[i] * 0.85) * 9);
            d[i * 4] = 255; d[i * 4 + 1] = 255; d[i * 4 + 2] = 255;
            d[i * 4 + 3] = Math.round(a * 255);
          }
          mctx.putImageData(maskenBild, 0, 0);

          /*
           * Frame 0 wird schon HIER mit der Deckung gezeichnet, die er danach
           * behält. Zeichnete man ihn anders und übergäbe dann an den
           * Hero-Canvas, wäre die Übergabe ein Kamerasprung — genau das, was
           * dieser Umbau abstellen soll.
           */
          pctx.setTransform(1, 0, 0, 1, 0, 0);
          pctx.globalCompositeOperation = "source-over";
          pctx.clearRect(0, 0, cb, ch);
          const ms = Math.max(cb / erstes.naturalWidth, ch / erstes.naturalHeight);
          const iw = erstes.naturalWidth * ms, ih = erstes.naturalHeight * ms;
          pctx.drawImage(erstes, (cb - iw) / 2, (ch - ih) / 2, iw, ih);
          // `destination-in`: es bleibt nur, wo die Maske deckt. KEIN
          // `globalAlpha` auf dem ganzen Bild — das wäre die Kreuzblende.
          pctx.globalCompositeOperation = "destination-in";
          pctx.drawImage(maske, 0, 0, cb, ch);
          pctx.globalCompositeOperation = "source-over";

          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(puffer, 0, 0);
          ctx.setTransform(dichteGeraet, 0, 0, dichteGeraet, 0, 0);
        }

        /* ————— Die Körner zeichnen ————— */
        const deckung = name === "zerfall" ? Math.min(1, t * 2.2)
          : name === "uebergabe" ? 1 - t * 0.45
          : name === "flugsand" ? Math.max(0, 0.55 * (1 - t))
          : 1;
        ctx.globalAlpha = deckung;
        for (let i = 0; i < KOERNER; i++) {
          ctx.fillStyle = farbe[i];
          ctx.fillRect(x[i], y[i], gr[i], gr[i]);
        }
        ctx.globalAlpha = 1;

        if (abgelaufen >= gesamt) {
          laeuft = false;
          setWeg(true);
          beiUebergabe();
          return;
        }
        id = requestAnimationFrame(bild);
      };
      id = requestAnimationFrame(bild);
    };

    const warten = window.setTimeout(starten, rest);
    return () => {
      laeuft = false;
      window.clearTimeout(warten);
      cancelAnimationFrame(id);
    };
  }, [ruhig, bereit, farben, erstes, staub, beiUebergabe]);

  if (weg) return null;

  return (
    <div
      className="ladeschirm"
      data-fertig={bereit ? "ja" : "nein"}
      data-zug={zug ? "ja" : "nein"}
      data-ruhig={ruhig ? "ja" : "nein"}
      data-zerfallen={zerfallen ? "ja" : "nein"}
      aria-hidden={bereit}
    >
      <div className="ladeschirm-inhalt">
        <svg ref={marke} className="lade-marke" viewBox="0 0 40 40" aria-hidden="true">
          {/*
            Ein Bogen über 350°, der am Kopf beginnt und dort wieder ankommt —
            die Schlange, die sich in den Schwanz beißt. `pathLength` normiert
            ihn auf 100, damit das Stylesheet in Prozent zählen kann.
          */}
          <path className="lade-zug" pathLength={100} d="M 20 3 A 17 17 0 1 1 17.05 3.26" />
          <circle className="lade-kopf" cx="20" cy="3" r="2.4" />
        </svg>
        <p className="lade-satz">because you are ready for the next step</p>
      </div>
    </div>
  );
}
