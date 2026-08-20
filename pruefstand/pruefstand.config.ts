/**
 * Der Prüfstand — Adressen, Breiten, Schwellwerte.
 *
 * Portiert aus `pawn-prototype/tools/pruefstand/pruefstand.config.ts`.
 *
 * Dieser Ordner wird von der Anwendung NIE importiert, und die Anwendung sieht
 * nichts von ihm: Playwright und alles Drumherum stehen ausschließlich in
 * `devDependencies`, das ausgelieferte Bündel enthält davon kein Byte. Der
 * Prüfstand misst und schreibt auf; er bewertet nicht. Alle Schwellwerte stehen
 * hier, damit im Messcode keine Zahl vergraben ist, die niemand findet.
 */

export type ZielName = "lokal" | "vorschau";

export interface Ziel {
  adresse: string;
  hinweis?: string;
}

export const ZIELE: Record<ZielName, Ziel> = {
  /**
   * Der gebaute Stand aus diesem Arbeitsverzeichnis, lokal ausgeliefert:
   *   npm run build && npx vite preview --port 4173
   * Misst denselben Code, der veröffentlicht würde — nützlich VOR dem Push und
   * der einzige Weg in Umgebungen, deren Browser keinen Ausgang ins Netz hat.
   */
  lokal: {
    adresse: "http://127.0.0.1:4173",
    hinweis: "gebauter Stand aus diesem Arbeitsverzeichnis (npx vite preview)",
  },
  /**
   * Die Vercel-Vorschau. Ihr Name enthält einen gekürzten Zweignamen und lässt
   * sich nicht verlässlich ableiten — deshalb steht hier kein Platzhalter,
   * sondern es wird `--adresse https://…` übergeben. Eine geratene Adresse wäre
   * eine Fehlerquelle, die niemand findet.
   */
  vorschau: {
    adresse: "",
    hinweis: "über --adresse oder PRUEFSTAND_ADRESSE zu übergeben",
  },
};

export const VORGABE_ZIEL: ZielName = "lokal";

export interface Breite {
  /** Name für den Bericht. „844" allein sagt nicht, ob hoch oder quer. */
  name: string;
  breite: number;
  hoehe: number;
  /**
   * Finger oder Maus. Der Browser emuliert entsprechend (`hasTouch`, `isMobile`),
   * die Medienabfrage `pointer: coarse` trifft also bei „finger" zu und bei
   * „maus" nicht.
   */
  eingabe: "finger" | "maus";
  /**
   * Werden hier Trefferflächen (3.5) gemessen?
   *
   * Nicht überall sinnvoll. Am Schreibtisch bedient die Maus, dort gilt die
   * 44-px-Regel nicht. Gemessen wird deshalb dort, wo mit dem Finger wirklich
   * bedient wird.
   */
  trefferflaechen: boolean;
}

/** Die vier Lagen aus dem Bauauftrag: 1280 · 1920 · 844 quer · 390. */
export const BREITEN: Breite[] = [
  { name: "390 hoch", breite: 390, hoehe: 844, eingabe: "finger", trefferflaechen: true },
  { name: "844 quer", breite: 844, hoehe: 390, eingabe: "finger", trefferflaechen: true },
  { name: "1280", breite: 1280, hoehe: 900, eingabe: "maus", trefferflaechen: false },
  { name: "1920", breite: 1920, hoehe: 1080, eingabe: "maus", trefferflaechen: false },
];

export interface SeitenZiel {
  name: string;
  pfad: string;
}

/**
 * Zwei Seiten: die Landing und der Selbsttest des Werks.
 *
 * Die Landing steht jetzt drin, weil auf ihr etwas steht. In Phase 0 war sie
 * leer, und eine leere Seite zu vermessen liefert lauter grüne Zahlen, die
 * nichts aussagen.
 */
export const SEITEN: SeitenZiel[] = [
  { name: "landing", pfad: "/" },
  { name: "werkstatt", pfad: "/werkstatt" },
];

/** Absichtlich ungültig — für 4.5. */
export const UNSINN_PFAD = "/diese-seite-gibt-es-nicht-4d9f21";

export const SCHWELLEN = {
  /** 3.3 — WCAG. Klein: unter 24 px, bzw. unter 18,66 px wenn fett. */
  kontrast_klein: 4.5,
  kontrast_gross: 3.0,
  gross_ab_px: 24,
  gross_ab_px_fett: 18.66,
  fett_ab_gewicht: 700,
  /** Kürzere Texte als das werden nicht gemessen (Trennzeichen, Symbole). */
  kontrast_min_zeichen: 2,

  /** 3.5 — Trefferfläche in px, nur bei Eingabeart „finger". */
  trefferflaeche: 44,

  /** 3.8 — ab welchem Anteil der kleineren Fläche eine Überschneidung gemeldet wird. */
  ueberlappung_min_anteil: 0.25,
  /** Waagerechter Überlauf in px, ab dem gemeldet wird (1 px sind Rundungen). */
  ueberlauf_px: 1,

  /**
   * 4.7 — Gewicht je Seite in Byte.
   *
   * Zurück auf drei Millionen. Die Schwelle stand zwischenzeitlich auf zehn,
   * weil die verworfene Fassung der Landing 183 Frames in drei Sequenzen lud.
   * Der eine Akt lädt 40 Frames, rund 610 kB die ganze Seite — der Grund für
   * die Ausnahme ist fort, also ist auch die Ausnahme fort. Eine angehobene
   * Schwelle, deren Anlass niemand mehr kennt, ist kein Gate.
   */
  gewicht_seite: 3_000_000,

  /** Wie viele der kleinsten/größten Werte im Bericht landen. */
  liste_laenge: 10,
} as const;

/**
 * Wartezeit nach dem Laden, bevor gemessen wird.
 *
 * Sie muss über der längsten Eröffnung liegen, die eine Seite abspielt — sonst
 * misst man eine Fläche, die noch in Bewegung ist, und nennt das Ergebnis einen
 * Befund.
 *
 * Längster Fall ist seit Phase 2 die Landing: 38 Frames Vorlauf, dann zeichnet
 * sich der Ouroboros über 1500 ms, dann zerfällt er in fünf Schlägen von
 * zusammen 4200 ms zu Staub, und erst danach läuft die Wortmarke zeichenweise
 * auf (450 ms Verzug plus siebenmal 55 ms plus 820 ms). Das sind rund 7,4 s
 * ohne das Laden selbst. Mit Reserve: 10 000 ms.
 *
 * Das kostet je Messpunkt fünf Sekunden mehr. Der Alternative — früher messen
 * und die Zahlen erklären — traut man beim zweiten Mal nicht mehr.
 */
export const RUHE_MS = 10_000;

/** Chromium-Pfad, falls die Umgebung einen mitbringt (Container, CI). */
export const CHROMIUM_PFAD = process.env.PRUEFSTAND_CHROMIUM ?? undefined;
