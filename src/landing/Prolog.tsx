/**
 * Der Prolog — der Anfang der Geschichte, nicht ein Ladebalken.
 *
 * FORM → AUFLÖSUNG → VERWANDLUNG → NEUE FORM. Ein Satz steht, der Wind trägt
 * ihn als Sand fort, hinter dem Sand steht ein Sturm, der Sturm klart auf und
 * legt das Tier frei, die Kamera geht hoch und übergibt an den Film.
 *
 * ————————————————————————————————————————————————————————————————————————
 * WAS HIER NICHT MEHR STEHT: EIN PARTIKELSYSTEM
 * ————————————————————————————————————————————————————————————————————————
 *
 * Die vorige Fassung hatte 3200 Körner, die aus einer gezeichneten Linie
 * fielen. In der Aufnahme war es als RASTER zu erkennen — Punkte auf einem
 * Gitter, gleiche Größe, gleiche Helligkeit. Der Grund war die Herkunft: die
 * Zielpunkte kamen aus einer gleichmäßigen Farbprobe des Films, und die
 * Startpunkte lagen auf einer Kurve. Beides sind Gitter.
 *
 * Jetzt kommt jedes Korn aus einem BILDPUNKT DER SCHRIFT. Der Satz wird in
 * ein Offscreen-Canvas gesetzt, seine Alphamaske gelesen, und jeder gedeckte
 * Bildpunkt ist ein Korn — an genau der Stelle, an der er stand. Wo keine
 * Schrift war, ist kein Sand. Das ist per Bauart kein Raster.
 *
 * Die Größen sind logarithmisch verteilt (viele winzige, wenige größere), die
 * Helligkeit um ±25 % gestreut, die Farbe aus dem ersten Bild des Films
 * abgetastet. Gleich große, gleich helle Punkte sind der Hauptgrund, warum
 * ein Feld als Raster liest.
 *
 * ————————————————————————————————————————————————————————————————————————
 * DER WIND HAT EINE RICHTUNG
 * ————————————————————————————————————————————————————————————————————————
 *
 * Von links nach rechts, leicht ansteigend. Die Geschwindigkeit hängt an der
 * Korngröße: kleine Körner werden schneller und höher getragen, große fallen
 * zurück — das ist die Physik von Saltation, und es ist der Unterschied
 * zwischen Sand und Konfetti. Die Turbulenz ist ein Rauschfeld über ORT UND
 * ZEIT, nicht ein Zufall je Bild; sonst flimmert das Feld, statt zu wehen.
 *
 * ————————————————————————————————————————————————————————————————————————
 * DER FILM LIEGT UNTER DER LEINWAND, NICHT DARAUF
 * ————————————————————————————————————————————————————————————————————————
 *
 * Der Prolog ist ein `<video>` — und das widerspricht der Regel aus der
 * Heldensequenz nicht, es ist ihre andere Hälfte. Dort wird AUFGESUCHT, in
 * beide Richtungen, im Takt einer Hand; dafür ist ein Dekoder schlecht. Hier
 * wird EINMAL VORWÄRTS ABGESPIELT; dafür ist er gebaut. Elf Sekunden als
 * Bildfolge wären 264 Frames je Satz, als Film sind es 1,1 MB.
 *
 * Er liegt UNTER der Leinwand und läuft mit `object-fit: cover` — dieselbe
 * Deckungsrechnung wie die Heldensequenz, also derselbe Ausschnitt. Die
 * Leinwand darüber ist der Sandschleier: sie ist am Anfang deckend, und die
 * Erosionsfront stanzt sie von links nach rechts frei. Was darunter erscheint,
 * ist das erste Bild des Sturms — sandblind und deckungsgleich hell.
 *
 * Am Ende der Erosion ist der Schleier fort, und die Leinwand zeigt nichts
 * mehr. Von da an spielt der Film selbst. Es gibt keine Blende: es wird nichts
 * getauscht, es wird nur nichts mehr darübergelegt.
 */
import { useEffect, useRef, useState } from "react";
import { dauer } from "../motion/tokens";

/** Der eine Satz. Mehr steht im ganzen Prolog nicht. */
export const SATZ = "because you are ready for the next step";

/**
 * In welcher Auflösung die Alphamaske der Schrift gelesen wird — 1 heißt: in
 * der der Leinwand.
 *
 * Ein Korn je gedecktem Bildpunkt. Die Zahl der Körner hängt damit allein an
 * dieser Auflösung, und sie darf NICHT geteilt werden: bei 3 waren es auf
 * 390 × 844 gemessene 144 Körner — die Schrift stand dann als fünf Bildpunkte
 * hoher Umriss in der Maske und hatte kaum noch gedeckte Punkte. Bei 1 sind es
 * einige tausend. Gemessen wird die Zahl beim Aufbau und steht in
 * `data-koerner` für den Prüfstand.
 */
const MASKE_SKALA = 1;

/** Obergrenze, falls ein sehr breites Fenster sehr viel Schrift ergibt. */
const KOERNER_MAX = 11000;

/** Wie viele Farbtöpfe die Körner teilen. Ein `fillStyle` je Topf, nicht je Korn. */
const TOEPFE = 14;

/**
 * Ein Wert-Rauschen mit zwei Oktaven, fest verdrahtet und ohne Zustand.
 *
 * DIE ÜBERBLENDUNG IST QUINTISCH, NICHT KUBISCH — und das ist kein
 * Feinschliff. Mit `3t² − 2t³` ist die zweite Ableitung an den Gitterpunkten
 * unstetig; das Auge sieht die Zellen als weiche Rechtecke. In der Aufnahme
 * bei 50 % standen sie als Kachelmuster über dem hellen Himmel — derselbe
 * Rasterbefund, den §1 am alten Partikelfeld erhebt, nur eine Ebene tiefer.
 * `6t⁵ − 15t⁴ + 10t³` ist an den Gitterpunkten zweimal stetig, und das Muster
 * verschwindet.
 */
function rausch(x: number, y: number): number {
  const s = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const glatt = (a: number, b: number) => {
    const xi = Math.floor(a), yi = Math.floor(b);
    const xf = a - xi, yf = b - yi;
    const w = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const u = w(xf), v = w(yf);
    return (s(xi, yi) * (1 - u) + s(xi + 1, yi) * u) * (1 - v)
      + (s(xi, yi + 1) * (1 - u) + s(xi + 1, yi + 1) * u) * v;
  };
  return glatt(x, y) * 0.76 + glatt(x * 2.13 + 5.7, y * 2.13 - 3.1) * 0.24;
}

const klemm = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Was der Prüfstand sehen können muss.
 *
 * Ein Messgerät, das den Zustand des Prologs aus Bildpunkten erraten muss,
 * misst am Ende sich selbst. Hier steht er als Zahl: welcher Schlag läuft, wie
 * weit die Front ist, wie viele Körner es gibt, und — für die Richtungsprüfung
 * aus §7 — wo ein festes Korn gerade steht.
 */
declare global {
  interface Window {
    __prolog?: {
      phase: "satz" | "erosion" | "film";
      front: number;
      koerner: number;
      /** Die Korngrößen als Histogramm über sechs Stufen von 0,5 bis 1,8 px. */
      groessen: number[];
      /** Wo eine Handvoll fester Körner gerade steht — für die Windrichtung. */
      proben: { x: number; y: number }[];
    };
  }
}

interface Korn {
  /** Ausgangsort in Bildpunkten der Leinwand. */
  x0: number; y0: number;
  /** Wann die Front es freigibt — 0 bis 1 über die Erosion. */
  frei: number;
  groesse: number;
  /** Trägheit: klein heißt schnell und hoch. */
  leicht: number;
  topf: number;
  /** Zwei Zufallszahlen, EINMAL gezogen — nicht je Bild. */
  a: number; b: number;
}

export interface PrologEigenschaften {
  /** Sind die Frames der Heldensequenz da? Vorher wird nicht übergeben. */
  bereit: boolean;
  /** Welcher Prologfilm — `3x4` oder `16x9`. */
  film: "3x4" | "16x9";
  ruhig: boolean;
  beiUebergabe: () => void;
}

export function Prolog({ bereit, film, ruhig, beiUebergabe }: PrologEigenschaften) {
  const wurzel = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const schleier = useRef<HTMLCanvasElement>(null);
  const [zerfallen, setZerfallen] = useState(false);
  const [abgelaufen, setAbgelaufen] = useState(false);
  /** Der Film kommt nicht. Gesetzt vom Zeitlimit oder vom Fehler am Video. */
  const ohneFilmRef = useRef(false);
  const [filmBereit, setFilmBereit] = useState(false);
  const [ruhigFertig, setRuhigFertig] = useState(false);
  /** Nur für den Prüfstand: wie viele Körner die Schrift ergeben hat. */
  const [koernerZahl, setKoernerZahl] = useState(0);
  const bereitRef = useRef(bereit);
  bereitRef.current = bereit;

  /* ————————————————————— Ruhemodus: kein Film, keine Körner ————————————————————— */
  useEffect(() => {
    if (!ruhig) return;
    const stand = dauer("--prolog-ruhig-stand");
    const blende = dauer("--prolog-ruhig-blende");
    // Erst das Attribut — es startet die Blende im Stylesheet —, dann die
    // Übergabe, wenn sie durch ist.
    const a = requestAnimationFrame(() => setRuhigFertig(true));
    const id = window.setTimeout(beiUebergabe, stand + blende);
    return () => { cancelAnimationFrame(a); window.clearTimeout(id); };
  }, [ruhig, beiUebergabe]);

  /* ————————————————————————— Erosion und Film ————————————————————————— */
  useEffect(() => {
    if (ruhig) return;
    const cv = schleier.current, vd = video.current, w = wurzel.current;
    if (!cv || !vd || !w) return;

    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) return;

    /*
     * Die Dichte der Leinwand.
     *
     * Gedeckelt bei 2 (§5 des Kontinuitätsauftrags) und zusätzlich über die
     * Fläche: ein Sandschleier braucht keine Netzhautauflösung, und die
     * Körner müssen je Bild gezeichnet werden. Der Film darunter läuft in
     * voller Auflösung, weil er die Leinwand nicht anfasst.
     */
    const flaeche = window.innerWidth * window.innerHeight;
    const dichteGeraet = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1.6e6 / flaeche));
    const cb = Math.round(w.clientWidth * dichteGeraet);
    const ch = Math.round(w.clientHeight * dichteGeraet);
    cv.width = cb; cv.height = ch;

    /* ————— Der Satz, einmal gesetzt und als Alphamaske gelesen ————— */
    const stil = getComputedStyle(w);
    const schriftPx = parseFloat(stil.getPropertyValue("--prolog-schrift")) || 15;
    const familie = stil.getPropertyValue("--schrift-zeile").trim() || "serif";
    const mb = Math.round(cb / MASKE_SKALA), mh = Math.round(ch / MASKE_SKALA);
    const maske = document.createElement("canvas");
    maske.width = mb; maske.height = mh;
    const mctx = maske.getContext("2d", { willReadFrequently: true });
    if (!mctx) return;
    const mSchrift = schriftPx * dichteGeraet / MASKE_SKALA;
    mctx.font = `italic 400 ${mSchrift}px ${familie}`;
    mctx.textAlign = "center";
    mctx.textBaseline = "middle";
    mctx.fillStyle = "#fff";
    mctx.fillText(SATZ, mb / 2, mh / 2);
    const roh = mctx.getImageData(0, 0, mb, mh).data;

    /* ————— Jeder gedeckte Bildpunkt wird ein Korn ————— */
    const koerner: Korn[] = [];
    let links = mb, rechts = 0;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mb; x++) {
        const a = roh[(y * mb + x) * 4 + 3];
        if (a < 40) continue;
        if (x < links) links = x;
        if (x > rechts) rechts = x;
        koerner.push({ x0: x * MASKE_SKALA, y0: y * MASKE_SKALA, frei: 0, groesse: 0, leicht: 0, topf: 0, a: 0, b: 0 });
      }
    }
    // Zu viele: gleichmäßig ausdünnen, damit die Form erhalten bleibt.
    if (koerner.length > KOERNER_MAX) {
      const behalt = KOERNER_MAX / koerner.length;
      for (let i = koerner.length - 1; i >= 0; i--) if (Math.random() > behalt) koerner.splice(i, 1);
    }
    setKoernerZahl(koerner.length);
    const spanne = Math.max(1, rechts - links);
    /** Sechs Stufen von 0,5 bis 1,8 px — die Verteilung, die §7 nachzählt. */
    const histogramm = new Array(6).fill(0);
    for (const k of koerner) {
      /*
       * Wann die Front dieses Korn freigibt.
       *
       * Nicht die Stelle allein — sonst wäre die Front eine senkrechte Kante
       * und die Schrift bräche wie mit dem Lineal auf. Das Rauschfeld
       * verschiebt sie örtlich um bis zu einem Viertel der Wortlänge; dadurch
       * bricht sie ungleichmäßig auf, wie Farbe von Stein.
       */
      const rx = k.x0 / MASKE_SKALA, ry = k.y0 / MASKE_SKALA;
      const stelle = (rx - links) / spanne;
      k.frei = klemm(stelle * 0.82 + rausch(rx * 0.06, ry * 0.06) * 0.26 - 0.04);
      /*
       * Logarithmisch verteilte Größe: 0,5 bis 1,8 Bildpunkte, viele winzige.
       * Gleich große Punkte sind der Hauptgrund, warum ein Feld als Raster
       * liest — das ist der Befund aus der Aufnahme, nicht eine Vermutung.
       */
      const u = Math.random();
      k.groesse = 0.5 * Math.pow(1.8 / 0.5, u * u);
      // Klein heißt leicht heißt schnell und hoch.
      k.leicht = 1 - (k.groesse - 0.5) / 1.3;
      k.topf = Math.min(TOEPFE - 1, Math.floor(Math.random() * TOEPFE));
      k.a = Math.random(); k.b = Math.random();
      histogramm[Math.min(5, Math.floor(((k.groesse - 0.5) / 1.3) * 6))]++;
    }

    /* ————— Die Farben: aus dem ersten Bild des Films, nicht gesetzt ————— */
    let grund: [number, number, number] = [14, 10, 6];
    const toepfe: string[] = new Array(TOEPFE).fill("rgba(216,178,120,.9)");
    let farbenDa = false;
    const farbenLesen = () => {
      if (farbenDa || vd.videoWidth === 0) return;
      const p = document.createElement("canvas");
      p.width = 40; p.height = 40;
      const pc = p.getContext("2d", { willReadFrequently: true });
      if (!pc) return;
      try { pc.drawImage(vd, 0, 0, 40, 40); } catch { return; }
      const d = pc.getImageData(0, 0, 40, 40).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      grund = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
      for (let t = 0; t < TOEPFE; t++) {
        // ±25 % Helligkeit, aus dem gelesenen Ton — nicht aus einer Palette.
        const f = 0.75 + (t / (TOEPFE - 1)) * 0.5;
        toepfe[t] = `rgb(${Math.min(255, Math.round(grund[0] * f))},`
          + `${Math.min(255, Math.round(grund[1] * f))},`
          + `${Math.min(255, Math.round(grund[2] * f))})`;
      }
      farbenDa = true;
    };

    /* ————— Das Maskenbild, mit dem der Schleier freigestanzt wird ————— */

    /*
     * DAS RAUSCHEN IST ORTSFEST UND ZUSAMMENHÄNGEND, NICHT JE ZELLE GEWÜRFELT.
     *
     * Die erste Fassung zog je Maskenzelle eine eigene Zufallszahl. In der
     * Aufnahme bei 50 % war das ein grobes Sprenkelband über dem halben Bild —
     * es sah nach Dithering aus, nicht nach Sand, und es ist derselbe Fehler,
     * den §1 am alten Partikelfeld benennt: gleich große, unzusammenhängende
     * Punkte lesen als Raster.
     *
     * Jetzt verschiebt ein WERT-RAUSCHFELD die Front örtlich. Die Kante wird
     * dadurch zerrissen statt gerade — und sie bleibt eine Kante, statt in
     * eine Wolke aus Halbdeckung zu zerfallen.
     */
    const lochB = Math.max(2, Math.round(cb / 6)), lochH = Math.max(2, Math.round(ch / 6));
    const loch = document.createElement("canvas");
    loch.width = lochB; loch.height = lochH;
    const lctx = loch.getContext("2d");
    const lochBild = lctx?.createImageData(lochB, lochH);
    const lochRausch = new Float32Array(lochB * lochH);
    for (let y = 0; y < lochH; y++) {
      for (let x = 0; x < lochB; x++) {
        /*
         * Gedreht abgetastet. Wert-Rauschen interpoliert auf einem Gitter und
         * hat deshalb achsenparallele Züge — in der Aufnahme auf 1440 waren
         * das weiche Rechtecke im Restschleier. Die Drehung nimmt ihnen die
         * Achse, ohne dass ein zweites Rauschfeld nötig wäre.
         */
        lochRausch[y * lochB + x] = rausch(x * 0.055 + y * 0.021, y * 0.055 - x * 0.021);
      }
    }

    const tief: [number, number, number] = [14, 10, 6];
    const erosionMs = dauer("--prolog-erosion");
    const auftrittMs = dauer("--prolog-auftritt");

    /** Steht das erste Bild des Films? Vorher zerfällt nichts. */
    const filmBereitRef = { current: false };

    let start = 0;
    let laeuft = true;
    let phase: "satz" | "erosion" | "film" = "satz";
    let lauf = 0;

    const zeichnen = (jetzt: number) => {
      if (!laeuft) return;
      if (!start) start = jetzt;
      const t = jetzt - start;

      if (phase === "satz") {
        // Der Satz steht, bis der Film das erste Bild zeigen kann.
        const auf = klemm(t / auftrittMs);
        // `front` trägt im Satz-Schlag den Auftritt — der Prüfstand wartet
        // darauf, dass der Satz VOLLSTÄNDIG steht, und das ist genau hier.
        window.__prolog = { phase, front: auf, koerner: koerner.length, groessen: histogramm, proben: [] };
        ctx.clearRect(0, 0, cb, ch);
        ctx.fillStyle = `rgb(${tief[0]},${tief[1]},${tief[2]})`;
        ctx.fillRect(0, 0, cb, ch);
        /*
         * NULL, NICHT EINS.
         *
         * Der erste Parameter ist der Stand der EROSION: 0 heißt „noch nichts
         * abgetragen", 1 heißt „ganz fort". Hier stand 1 — und damit fiel
         * `schriftZeichnen` durch beide Zweige, ohne etwas zu zeichnen. Der
         * Schlag „satz" zeigte deshalb nie einen Satz, sondern nur den
         * dunklen Grund; sichtbar wurde die Zeile erst im ersten Bild der
         * Erosion, wo sie sofort zu zerfallen begann.
         *
         * Aufgefallen ist es, als der Film künstlich verzögert wurde und der
         * Schlag lange genug stand, um ihn aufzunehmen: eine vollständig
         * schwarze Fläche, elf Sekunden lang. Auf einer langsamen Leitung ist
         * genau das die zweite Hälfte des gemeldeten Schwarzbildes.
         */
        schriftZeichnen(0, auf);
        if (filmBereitRef.current && t > auftrittMs) { phase = "erosion"; start = jetzt; }
        lauf = requestAnimationFrame(zeichnen);
        return;
      }

      if (phase === "erosion") {
        farbenLesen();
        const front = klemm(t / erosionMs);
        window.__prolog = { phase, front, koerner: koerner.length, groessen: histogramm, proben: probeStellen(front) };

        /*
         * Der Schleier: erst der Grund, dann die Löcher.
         *
         * Der Grund wandert von `--tief` zum Mittel des ersten Filmbildes.
         * Er ist nicht die Farbe des Films — der liegt darunter —, sondern
         * die Farbe des Sandes, der ihn noch verdeckt. Beide treffen sich,
         * bevor das letzte Loch aufgeht; darum gibt es keinen Sprung.
         */
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, cb, ch);
        /*
         * ZUERST WANDERT DER GRUND, DANN GEHEN DIE LÖCHER AUF — in dieser
         * Reihenfolge, und das ist gemessen, nicht gefühlt.
         *
         * `--tief` hat eine Helligkeit von 11 von 255, das erste Bild des
         * Films 137. Diese 126 müssen überbrückt werden, und §7 lässt dafür
         * höchstens 12 je 120 ms zu — also mindestens 1260 ms. Zusammengelegt
         * mit dem Aufgehen der Löcher waren es gemessene 17,6 auf einen
         * Schlag.
         *
         * Getrennt kostet das Aufgehen dagegen NICHTS: der Grund ist dann
         * bereits der Mittelwert genau dieses Bildes. Was durch die Löcher
         * kommt, ist im Mittel gleich hell wie das, was verschwindet — es
         * ändert sich nur die Textur. Genau das meint §3 mit
         * „deckungsgleich hell".
         */
        const g = (i: number) => Math.round(tief[i] + (grund[i] - tief[i]) * klemm(front / 0.75) * 0.55);
        ctx.fillStyle = `rgb(${g(0)},${g(1)},${g(2)})`;
        ctx.fillRect(0, 0, cb, ch);

        // Die Schrift steht, solange die Front sie nicht erreicht hat.
        schriftZeichnen(front, 1);

        // Löcher: von links nach rechts, rauschgedithert.
        if (lctx && lochBild) {
          const d = lochBild.data;
          for (let y = 0; y < lochH; y++) {
            for (let x = 0; x < lochB; x++) {
              const i = y * lochB + x;
              const stelle = x / (lochB - 1);
              /*
               * DER ÜBERGANG IST BREIT, UND DAS IST DER PUNKT.
               *
               * Mit einer schmalen Kante (Faktor 9) las die Aufnahme bei 50 %
               * als WISCHBLENDE: ein senkrechter Vorhang, der nach rechts
               * gezogen wird. Das ist ein Grafikmittel, keine Physik — und §0
               * verlangt das Gegenteil.
               *
               * Sand in der Luft hat keine Kante, er dünnt aus. Das Band ist
               * deshalb rund die halbe Bildbreite breit, und das Rauschfeld
               * mit niedriger Frequenz macht daraus Schwaden statt einer
               * Linie. Was man sieht, ist eine Bö, die den Dunst wegnimmt.
               */
              const auf = klemm((front - 0.2) / 0.8);
              const wert = klemm((auf * 1.5 - stelle * 0.62 - (lochRausch[i] - 0.5) * 0.62) * 2.2);
              d[i * 4] = 255; d[i * 4 + 1] = 255; d[i * 4 + 2] = 255;
              d[i * 4 + 3] = Math.round(wert * 255);
            }
          }
          lctx.putImageData(lochBild, 0, 0);
          ctx.globalCompositeOperation = "destination-out";
          ctx.drawImage(loch, 0, 0, cb, ch);
          ctx.globalCompositeOperation = "source-over";
        }

        koernerZeichnen(front);

        if (front >= 1) {
          phase = "film";
          ctx.clearRect(0, 0, cb, ch);
          setZerfallen(true);
          if (ohneFilmRef.current) {
            // Nichts abzuspielen. Das Ende ist trotzdem erreicht, sonst
            // wartete die Übergabe unten auf ein `ended`, das nie kommt.
            setAbgelaufen(true);
          } else {
            vd.play().catch((e) => {
              console.error("Oroboros: Prolog konnte nicht starten — " + String(e)
                + ". Es wird ohne Film übergeben.");
              ohneFilmRef.current = true;
              setAbgelaufen(true);
            });
          }
        }
        lauf = requestAnimationFrame(zeichnen);
        return;
      }

      // Phase „film": die Leinwand ist leer, der Film spielt selbst.
      window.__prolog = { phase, front: 1, koerner: koerner.length, groessen: histogramm, proben: [] };
      laeuft = false;
    };

    /**
     * Wo feste Körner bei diesem Frontstand stehen.
     *
     * Dieselbe Rechnung wie in `koernerZeichnen`, für vierundzwanzig Körner —
     * damit der Prüfstand die Windrichtung an echten Bahnen messen kann statt
     * an einem Bildvergleich, in dem tausend Körner übereinanderliegen.
     */
    function probeStellen(front: number) {
      const raus = [];
      const schritt = Math.max(1, Math.floor(koerner.length / 24));
      for (let i = 0; i < koerner.length && raus.length < 24; i += schritt) {
        const k = koerner[i];
        const s2 = Math.max(0, front - k.frei);
        const v = 0.55 + k.leicht * 0.9;
        raus.push({
          x: k.x0 + s2 * cb * 1.25 * v + (rausch(k.x0 * 0.01 + s2 * 1.7, k.y0 * 0.01) - 0.5) * cb * 0.05,
          y: k.y0 - s2 * ch * 0.16 * k.leicht
            + (rausch(k.x0 * 0.013, k.y0 * 0.013 + s2 * 1.3) - 0.5) * ch * 0.05,
        });
      }
      return raus;
    }

    /** Zeichnet den Satz, soweit die Front ihn noch nicht geholt hat. */
    function schriftZeichnen(front: number, deckung: number) {
      if (!ctx) return;
      ctx.save();
      ctx.globalAlpha = deckung;
      ctx.font = `italic 400 ${schriftPx * dichteGeraet}px ${familie}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = stil.getPropertyValue("--creme").trim() || "#F4EDE2";
      if (front <= 0) {
        ctx.fillText(SATZ, cb / 2, ch / 2);
      } else if (front < 1) {
        /*
         * Die stehengebliebene Schrift wird BESCHNITTEN, nicht ausgeblendet.
         * Ein Buchstabe, der blasser wird, verschwindet; ein Buchstabe, dem
         * der Wind die linke Hälfte nimmt, zerfällt. Der Schnitt folgt
         * derselben Front wie die Körner, samt Rauschen.
         */
        ctx.beginPath();
        const kante = links * MASKE_SKALA + spanne * MASKE_SKALA * (front / 0.82 + 0.04);
        for (let y = 0; y <= ch; y += 8) {
          const v = rausch((kante / MASKE_SKALA) * 0.06, (y / MASKE_SKALA) * 0.06);
          const kx = kante + (v - 0.5) * spanne * MASKE_SKALA * 0.26;
          if (y === 0) ctx.moveTo(kx, 0); else ctx.lineTo(kx, y);
        }
        ctx.lineTo(cb + 40, ch); ctx.lineTo(cb + 40, 0); ctx.closePath();
        ctx.clip();
        ctx.fillText(SATZ, cb / 2, ch / 2);
      }
      ctx.restore();
    }

    /** Zeichnet die Körner, nach Farbtopf gebündelt. */
    function koernerZeichnen(front: number) {
      if (!ctx) return;
      const wind = cb * 1.25;
      for (let t = 0; t < TOEPFE; t++) {
        ctx.fillStyle = toepfe[t];
        ctx.beginPath();
        for (const k of koerner) {
          if (k.topf !== t) continue;
          const s = front - k.frei;
          if (s <= 0) continue;
          /*
           * Der Wind: eine Richtung, leicht ansteigend, Geschwindigkeit nach
           * Größe. Die Turbulenz kommt aus dem Rauschfeld über Ort UND Zeit —
           * ein Zufall je Bild wäre Flimmern, kein Wehen.
           */
          const v = 0.55 + k.leicht * 0.9;
          const x = k.x0 + s * wind * v + (rausch(k.x0 * 0.01 + s * 1.7, k.y0 * 0.01) - 0.5) * cb * 0.05;
          const y = k.y0 - s * ch * 0.16 * k.leicht
            + (rausch(k.x0 * 0.013, k.y0 * 0.013 + s * 1.3) - 0.5) * ch * 0.05;
          if (x > cb + 8 || y < -8 || y > ch + 8) continue;
          const gr = k.groesse * dichteGeraet;
          ctx.rect(x, y, gr, gr);
        }
        ctx.fill();
      }
    }

    /* ————— Der Film, und was passiert, wenn er nicht kommt ————— */

    /*
     * KEIN WARTEN OHNE FRIST.
     *
     * Hier stand nur `addEventListener("loadeddata", …)`. Kam das Ereignis
     * nie — Dekoderfehler, blockierte Datei, ein Safari im Stromsparmodus,
     * das nicht vorlädt —, blieb der Schlag „satz" für immer stehen. Auf dem
     * Schirm ist das `--tief`, also praktisch Schwarz, mit einem kleinen
     * cremefarbenen Satz. Kein Fehler in der Konsole, keine fehlgeschlagene
     * Anfrage, `body { overflow: hidden }` bleibt gesetzt: eine Seite, die
     * ausgeliefert wird und trotzdem nichts zeigt.
     *
     * Nachgestellt, indem `/prolog/**` abgewiesen wurde: nach 25 s stand die
     * Seite in `phase: "satz"`, `overflow: hidden`, mit null Konsolenfehlern.
     *
     * Jetzt gibt es drei Wege heraus, und alle drei melden sich:
     *   · `error` am Video — sofort, der Film kommt nicht.
     *   · `--prolog-geduld` verstrichen, ohne dass ein Bild da ist — der Film
     *     kommt zu spät, es geht ohne ihn weiter.
     *   · das Zeitlimit in der Übergabe unten, falls die Heldenframes fehlen.
     *
     * Ohne Film läuft die Erosion trotzdem: der Sand weht fort, und darunter
     * liegt die Bühne mit ihrem ersten Frame. Das ist kein Ersatz für den
     * Prolog, aber es ist eine Seite, die man benutzen kann.
     */
    const kannLos = () => {
      if (filmBereitRef.current) return;
      filmBereitRef.current = true;
      /*
       * `autoplay` hat den Film angestoßen, damit überhaupt geladen wird —
       * siehe die Erklärung am `<video>`. Jetzt steht er wieder still, am
       * ersten Bild. Gespielt wird erst nach der Erosion, wie gehabt.
       *
       * Sichtbar ist davon nichts: der Schleier ist im Schlag „satz"
       * vollflächig deckend, und `currentTime = 0` nimmt die zwei, drei
       * Bilder zurück, die bis hierher gelaufen sein können.
       */
      vd.pause();
      try { vd.currentTime = 0; } catch { /* vor dem ersten Bild nicht setzbar */ }
      setFilmBereit(true);
      farbenLesen();
    };
    const ohneFilm = (grund: string) => {
      if (filmBereitRef.current) return;
      ohneFilmRef.current = true;
      console.error(`Oroboros: Prolog ohne Film — ${grund}. `
        + "Der Prolog läuft ohne ihn weiter, damit die Seite nicht stehen bleibt.");
      kannLos();
    };
    /*
     * OHNE `capture`, UND NUR MIT `vd.error`.
     *
     * Die erste Fassung hörte mit `capture: true`. Damit fing sie auch das
     * `error` der einzelnen `<source>`-Elemente ab — und genau das feuert im
     * Normalfall: das Chromium des Prüfstands kann H.264 nicht, verwirft die
     * erste Quelle und nimmt die zweite. Der Prolog hielt sich daraufhin für
     * kaputt und übergab nach 4,7 s statt den Film zu spielen.
     *
     * Das `error` des VIDEO-Elements feuert erst, wenn keine Quelle mehr
     * übrig ist, und setzt dabei `vd.error`. Beides wird geprüft.
     */
    const beiVideofehler = () => {
      if (!vd.error) return;
      ohneFilm(`Video-Fehler ${vd.error.code}`);
    };
    vd.addEventListener("loadeddata", kannLos);
    vd.addEventListener("error", beiVideofehler);
    if (vd.readyState >= 2) kannLos();
    const geduld = dauer("--prolog-geduld");
    const frist = window.setTimeout(
      () => ohneFilm(`kein Bild nach ${(geduld / 1000).toFixed(0)} s`), geduld);

    lauf = requestAnimationFrame(zeichnen);
    return () => {
      laeuft = false;
      cancelAnimationFrame(lauf);
      window.clearTimeout(frist);
      vd.removeEventListener("loadeddata", kannLos);
      vd.removeEventListener("error", beiVideofehler);
    };
  }, [ruhig, beiUebergabe]);

  /*
   * Übergeben wird, wenn BEIDES steht: der Film ist durchgelaufen und die
   * Frames der Heldensequenz sind da. Der Film hält am letzten Bild — und das
   * ist derselbe Ausschnitt wie Frame 1 der Sequenz, gemessene Differenz 3,1
   * von 255. Wer wartet, sieht deshalb ein Standbild, keinen Ladezustand.
   *
   * UND ES WIRD ÜBERGEBEN, WENN DIE FRAMES NICHT KOMMEN.
   *
   * `ladeVorlauf` zählt auch fehlgeschlagene Bilder mit (`img.onerror` ruft
   * denselben Zähler wie `img.onload`, siehe `motion/sequenz.ts`), ein
   * einzelnes fehlendes Bild hält also nichts auf. Bleibt eine Anfrage aber
   * offen — kein `load`, kein `error`, nur Stille —, käme `beiFertig` nie.
   * Nach `--prolog-geduld` wird deshalb übergeben, egal wie viele Frames
   * fehlen, und der Grund steht in der Konsole. Fehlende Frames bleiben
   * `null`; der Zeichner behält an ihrer Stelle den letzten gültigen Frame.
   */
  useEffect(() => {
    const vd = video.current;
    if (!vd || ruhig) return;
    const e = () => setAbgelaufen(true);
    vd.addEventListener("ended", e);
    return () => vd.removeEventListener("ended", e);
  }, [ruhig]);
  useEffect(() => {
    if (ruhig || !abgelaufen) return;
    if (bereit) { beiUebergabe(); return; }
    const geduld = dauer("--prolog-geduld");
    const id = window.setTimeout(() => {
      console.error(`Oroboros: Heldensequenz nach ${(geduld / 1000).toFixed(0)} s `
        + "nicht vollständig — es wird trotzdem übergeben. Fehlende Frames "
        + "bleiben leer, der Zeichner hält den letzten gültigen.");
      beiUebergabe();
    }, geduld);
    return () => window.clearTimeout(id);
  }, [abgelaufen, bereit, ruhig, beiUebergabe]);

  return (
    <div
      className="prolog"
      ref={wurzel}
      data-zerfallen={zerfallen ? "ja" : "nein"}
      data-ruhig={ruhig ? "ja" : "nein"}
      data-fertig={ruhigFertig ? "ja" : "nein"}
    >
      {!ruhig && (
        <video
          ref={video}
          className="prolog-film"
          /*
            `autoplay` — UND ES GEHT NICHT UM AUTOMATISCHES ABSPIELEN.

            Der Film wird nach wie vor erst am Ende der Erosion gestartet; das
            `loadeddata` unten hält ihn sofort wieder an und spult auf null
            zurück. Das Attribut steht hier, weil es die einzige deklarative
            Art ist, einen Browser zum LADEN zu bewegen, der `preload` nicht
            befolgt.

            Gemessen an genau dieser Datei, isoliert:

              preload="auto", kein play()   → loadeddata nach 338 ms
              preload="none", kein play()   → STILLE, readyState 0
              preload="none", mit play()    → loadeddata nach  21 ms
              preload="none", autoplay      → loadeddata nach  16 ms

            iOS Safari behandelt `preload` bei einem Video ohne `autoplay` wie
            `none`: es lädt kein Byte, bis jemand `play()` ruft. Der Prolog
            wartete aber auf `loadeddata`, BEVOR er `play()` rief — beide
            warteten aufeinander. Auf dem Schirm war das der schwarze Grund.

            `muted` und `playsInline` sind die Bedingung dafür, dass iOS das
            Autoplay überhaupt erlaubt; ohne sie wäre es abgelehnt und die
            Klemme bliebe.
          */
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          {/*
            MP4 ZUERST, WEBM ALS RÜCKFALL — und nicht umgekehrt.
            H.264 ist hier die leichtere Fassung (1,09 gegen 0,84 MB bei
            besserer Güte) und läuft überall, Safari und iOS eingeschlossen.
            VP9 steht dahinter für den einen Fall, in dem H.264 fehlt: das
            quelloffene Chromium des Prüfstands bringt keine proprietären
            Dekoder mit. Ohne diese zweite Quelle ließe sich der Prolog nicht
            ansehen — und was nicht angesehen wurde, gilt nicht als fertig.
          */}
          <source src={`/prolog/prolog-${film}.mp4`} type="video/mp4" />
          <source src={`/prolog/prolog-${film}.webm`} type="video/webm" />
        </video>
      )}
      <canvas
        ref={schleier}
        className="prolog-schleier"
        aria-hidden="true"
        data-koerner={koernerZahl || undefined}
        data-film={filmBereit ? "bereit" : "wartet"}
      />
      {/* Für alle, die die Seite hören statt sehen — und für den Ruhemodus. */}
      <p className={`prolog-satz${ruhig ? "" : " nur-fuer-leser"}`}>{SATZ}</p>
    </div>
  );
}
