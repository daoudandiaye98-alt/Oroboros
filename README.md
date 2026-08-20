# oroboros-werk

Das Template, aus dem jede Kundenseite geforkt wird — und die Landing von
Oroboros Design.

**Die Landing** (`/`) ist eine Seite, eine gepinnte Bühne, eine Bewegung: die
Hornviper zieht durch die Düne, verlangsamt, rollt sich ein, schließt zum
Ouroboros — die Kamera fährt auf Aufsicht. Ein durchgehender Film aus EINER
Aufnahme, vollständig scroll-gebunden, kein `<video>`.

Darüber liegen genau drei Textelemente: die Wortmarke am Anfang, der
Rollhinweis, das Siegel am Ende. Sonst nichts.

**Das Fundament** (Phase 0) trägt sie: eine Bewegungssprache in Zahlen,
Module, die sie ausführen, eine Beweis-Route unter `/werkstatt`, an der man
sie einzeln nachmisst, und ein Prüfstand gegen die ZERA-Kontrollen.

## Die Bewegung

Bühne 520 svh, darin ein `position: sticky`-Kind über 100 svh. Der Fortschritt
wird mit `--nachzug-scrub` geglättet; alle Fenster stehen in `bewegung.css`.

| | Fenster | Wirkung |
|---|---|---|
| Film | 0.02 → 0.86 | Frame per `Math.round`, harter Wechsel |
| Hinweis | 0.01 → 0.09 | blendet aus |
| Wortmarke | 0.05 → 0.24 | blendet aus, zieht 60 px nach oben |
| Abdunklung | 0.88 → 0.97 | flächig |
| Siegel | 0.90 → 0.99 | blendet ein, Maßstab .98 → 1 |

## Assets

Eine Quelle: `assets/film-hoch.mp4` — 3:4, 828 × 1108, 10 s. **Im Repo**, nicht
in `.gitignore`: der CDN-Pfad, aus dem sie stammt, ist eine
Generierungsablage und keine dauerhafte Adresse.

```bash
bash scripts/pruefsummen.sh       # prüft alle Quellen
node scripts/sequenz-bauen.mjs    # Frames neu erzeugen
```

40 Frames à 420 px, WebP q45 → 482 kB, unter `public/seq/film-p/`, ebenfalls
im Repo, damit der Vercel-Build kein ffmpeg braucht.

Unter `assets/hoch/` und `assets/quer/` liegen noch die vierzehn Quellen des
**verworfenen** Drei-Akt-Auftrags. Sie werden von nichts mehr benutzt und
bleiben nur liegen, weil sie referenz-verriegelt sind und nicht nachgeneriert
werden dürfen. Wer sie nicht mehr will, löscht sie bewusst.

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
| `node pruefstand/server.mjs` | liefert `dist/` mit gzip aus — für ehrliche Ladezeiten |

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
