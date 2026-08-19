# oroboros-werk

Das Template, aus dem jede Kundenseite geforkt wird — und die Landing von
Oroboros Design.

**Die Landing** (`/`) ist eine einzige Seite und eine einzige durchlaufende
Bewegung: eine Wüstenotter zieht durch die Düne, rollt sich ein und wird zum
Ouroboros. Drei gepinnte Bühnen, vollständig scroll-gebunden, keine
Autoplay-Zeitachse. Bewegung ausschließlich als Canvas-Bildsequenz — kein
`<video>`.

**Das Fundament** (Phase 0) trägt sie: eine Bewegungssprache in Zahlen, vier
Module, die sie ausführen, eine Beweis-Route unter `/werkstatt`, an der man
sie einzeln nachmisst, und ein Prüfstand gegen die ZERA-Kontrollen.

## Die drei Akte

| | Höhe | Inhalt | Sequenz |
|---|---|---|---|
| I · Kopf | 180 svh | Blickkontakt, Wortmarke im Z-Sandwich | `head-*` |
| II · Weg | 280 svh | die Otter quert, dann steigen drei Karten | `trav-*` |
| III · Kreis | 400 svh | sie rollt sich ein, das Bild wird zum Zeichen | `coil-*` (rückwärts) |

Rechts mittig läuft ein Fortschrittsring mit. Am Seitenende ist er
geschlossen — das ist die Aussage der Marke, ausgedrückt durch die Navigation.

## Assets

Die vierzehn Quelldateien liegen unter `assets/` **im Repo**, nicht in
`.gitignore`: der CDN-Pfad, aus dem sie stammen, ist eine Generierungsablage
und keine dauerhafte Adresse.

```bash
bash scripts/assets-holen.sh      # Erstbezug, prüft alle 14 Prüfsummen
bash scripts/pruefsummen.sh       # nur prüfen
node scripts/sequenzen-bauen.mjs  # Frames + Standbilder neu erzeugen
```

Die erzeugten Frames liegen unter `public/seq/` und `public/still/`, ebenfalls
im Repo — der Vercel-Build braucht dadurch kein ffmpeg. Beide Formatsätze sind
vorhanden (3:4 und 16:9); welcher geladen wird, entscheidet beim Start ein
einziges `matchMedia('(orientation: portrait)')`.

Schlägt eine Prüfsumme fehl: **melden, nicht ersetzen und nicht
nachgenerieren.** Alle Bilder sind gegen dieselbe Referenzaufnahme verriegelt;
ein nachgeneriertes Motiv wechselt zwischen den Akten das Tier.

## Loslegen

```bash
nvm use            # Node aus .nvmrc
npm install
npm run dev        # http://localhost:5173/werkstatt
```

| Befehl | was er tut |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | `tsc -b` und dann das Bündel |
| `npm run typecheck` | nur die Typen |
| `npm run gesetz` | prüft das Gesetz der drei Kurven (siehe unten) |
| `npm run pruefstand` | misst `/` und `/werkstatt` auf 1280 / 1920 / 844 quer / 390 |
| `npm run selbsttest` | fährt die Landing in beiden Formaten ab, misst die Bewegung |

## Das Gesetz der drei Kurven

`src/styles/bewegung.css` ist die **einzige** Datei im Repo, in der eine
Zeitangabe oder eine Kurve stehen darf. `src/motion/tokens.ts` liest sie zur
Laufzeit aus `getComputedStyle` und gibt sie als typisiertes Objekt zurück
(Sekunden für GSAP, Kurven als registrierte `CustomEase` aus denselben
Bezier-Werten). In TypeScript wird keine Zahl doppelt gepflegt.

Belegt wird das mit einem Befehl, und er ist ein Abnahmekriterium:

```bash
grep -rn "cubic-bezier\|duration:\s*[0-9]" src/ --exclude-dir=styles
# → null Treffer
```

## Die Ordnung

```
src/
  styles/bewegung.css   die Token — das Gesetz
  motion/
    tokens.ts           liest die CSS-Variablen aus, typsicher
    split.ts            Wort-/Zeichen-Spalter, mit aria-Regel
    reveal.ts           Auftritts-Gesetz (IntersectionObserver, 20 %)
    scrub.ts            ScrollTrigger-Wrapper, erzwingt ease "none"
    lerp.ts             Nachzieh-Utility + die eine Lenis-Instanz
    sequenz.ts          Bildsequenz laden und deckend zeichnen
    buehne.ts           Fortschritt einer gepinnten Bühne
  landing/              die Landing: drei Akte, Ring, Ladeschirm
  sections/             leer — kommt später
  pages/Werkstatt.tsx   die Beweis-Route /werkstatt
scripts/                Assets holen, Sequenzen bauen
konzept/FORMULAR.md     das Konzept-Formular, sieben Felder
pruefstand/             Playwright, misst Seiten × Breiten
DREHBUCH.md             was beim Bauen aufgefallen ist
```

## `/werkstatt`

Vier nackte Blöcke, jeder belegt genau ein Werkzeug:

| Block | Werkzeug | was er zeigt |
|---|---|---|
| A | `split.ts` + `reveal.ts` | ein Absatz tritt wortweise auf, `aria-label` bleibt ganz |
| B | `reveal.ts` | vier Karten, gestaffelt |
| C | `scrub.ts` | ein Kasten wandert über 100 vh, gepinnt, linear |
| D | `lerp.ts` | ein Punkt zieht dem Zeiger nach |

Oben rechts ein Schalter, der `prefers-reduced-motion` über eine Klasse am
`<html>` nachstellt — damit der Fallback ohne Systemeinstellung prüfbar ist.

**Diese Route bleibt dauerhaft im Template.** In Kundenforks wird sie nicht
gelöscht, sondern von der Indexierung ausgeschlossen. Sie ist der Selbsttest
des Werks.

## Abhängigkeiten

Vier zur Laufzeit, und jede mit Grund:

| Paket | Begründung |
|---|---|
| `react` / `react-dom` | die Anwendung |
| `@fontsource/*` | Jost, EB Garamond, Space Mono — selbst gehostet statt Google-Link, sonst springt das Layout beim Schriftwechsel |
| `gsap` | Zeitleisten, ScrollTrigger, CustomEase — seit der Webflow-Übernahme vollständig kostenlos |
| `lenis` | weicher Scroll, genau eine Instanz (`src/motion/lerp.ts`) |

Kein Three.js. Kein WebGL. Kein Router — für eine einzige Fallunterscheidung
wäre er eine Abhängigkeit ohne Gegenwert; er kommt, wenn es mehr als eine Seite
gibt. Playwright und alles Drumherum stehen ausschließlich in
`devDependencies`; das ausgelieferte Bündel enthält davon kein Byte.
