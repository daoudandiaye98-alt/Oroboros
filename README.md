# oroboros-werk

Das Template, aus dem jede Kundenseite geforkt wird.

**Phase 0 — Fundament.** Keine Seite, kein Inhalt, keine Sektion mit Text.
Was hier steht, ist Werkzeug: eine Bewegungssprache in Zahlen, vier Module,
die sie ausführen, eine Beweis-Route, an der man sie einzeln nachmisst, und
ein Prüfstand, der die Seite gegen die ZERA-Kontrollen vermisst.

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
| `npm run pruefstand` | misst `/werkstatt` auf 1280 / 1920 / 844 quer / 390 |

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
  sections/             leer — kommt in Phase 1
  pages/Werkstatt.tsx   die Beweis-Route /werkstatt
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
| `gsap` | Zeitleisten, ScrollTrigger, CustomEase — seit der Webflow-Übernahme vollständig kostenlos |
| `lenis` | weicher Scroll, genau eine Instanz (`src/motion/lerp.ts`) |

Kein Three.js. Kein WebGL. Kein Router — für eine einzige Fallunterscheidung
wäre er eine Abhängigkeit ohne Gegenwert; er kommt, wenn es mehr als eine Seite
gibt. Playwright und alles Drumherum stehen ausschließlich in
`devDependencies`; das ausgelieferte Bündel enthält davon kein Byte.
