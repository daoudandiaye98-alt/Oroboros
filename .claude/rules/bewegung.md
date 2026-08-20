# Regel · Bewegung

Sequenzen, Kamerapfade, Scroll-Choreografie. Verwiesen aus `CLAUDE.md`.
Jede Regel hier hat einen Fehler als Vater.

## Das Gesetz der drei Kurven

`src/styles/bewegung.css` ist die **einzige** Datei im Repo, in der eine
Zeitangabe, eine Kurve oder ein Nachziehfaktor stehen darf. `src/motion/tokens.ts`
liest sie zur Laufzeit aus `getComputedStyle`. In TypeScript wird keine Zahl
doppelt gepflegt — auch keine `0.13` in einem rAF-Rumpf.

Belegt mit `npm run gesetz`. Der Befehl greift heute nur `cubic-bezier` und
`duration:` — ein blanker Faktor in einer Multiplikation entgeht ihm. Das
entschuldigt ihn nicht, es macht den Beleg nur schwächer als die Regel.

## Materialtor — die Rechnung vor der Zeile

Vor jeder Kamerafahrt, jedem Zoom, jedem Parallax, jeder Bildsequenz:

```
benötigte Breite = Viewportbreite × maxScale × devicePixelRatio
benötigte Höhe   = Viewporthöhe  × maxScale × devicePixelRatio
```

Gegen die **echte** Quellauflösung halten (`identify`, `ffprobe`), nicht schätzen.

| Ergebnis | Konsequenz |
|---|---|
| Quelle ≥ benötigt | freigegeben |
| Quelle 80–100 % | nur mit Obergrenze für `maxScale`, Zahl im Code festgeschrieben |
| Quelle < 80 % | **STOP** — Material neu erzeugen oder Bewegung umplanen |

1440 × 900 bei DPR 2 und `maxScale` 1.6 verlangt **4608 × 2880**. Ein 1920er
Asset trägt das nicht, und kein Filter ändert das.

**Seitenverhältnis aus dem Endgerät ableiten.** Ein 16:9-Asset in einem
9:16-Viewport verliert unter `object-fit: cover` 68 % der Breite — die
Komposition liegt dann außerhalb des Bildschirms. Hochformat wird als
Hochformat erzeugt, nicht beschnitten.

## Kein `scale()` als Reparatur

Verboten, um ein zu kleines Asset zu retten: `transform: scale()`,
`overflow: hidden`, negative Margins, `background-size: cover` auf einer zu
kleinen Datei, Upscaling im Browser.

Das sind Wege, eine Materialgrenze unsichtbar zu machen, statt sie zu lösen.
Trägt das Material nicht: Grenze benennen, nicht kaschieren.

`transform: scale()` als **gestaltete Bewegung** bleibt erlaubt — die Grenze
verläuft am Zweck, nicht am Schlüsselwort.

## Overscan

Ein bewegtes Bild bekommt mindestens **10 % Reserve** über den maximal
sichtbaren Ausschnitt hinaus. Ohne Reserve wird jede spätere Feinjustierung
der Kamera zu einem neuen Kantenfehler.

Über den gesamten Pfad darf nie auftreten: sichtbare Bildkante, Leerfläche,
ungewollter Beschnitt des Subjekts, Auflösungszusammenbruch bei maximalem Zoom,
Bewegung über die Quellgrenzen hinaus.

Geprüft werden **die Extremwerte**: Pfadanfang, Pfadende, jeder Richtungswechsel.
Nicht die Mitte — dort ist immer alles in Ordnung.

## Framewahl

- 40–60 Frames für 4–5 s Quellmaterial. Bei Scroll-Bindung reichen 10–12 fps.
- WebP, Qualität 52–58 → ~17–22 KB je Frame.
- **Alle Frames vor Aktivierung laden**, mit sichtbarem Fortschritt. Eine halb
  geladene Sequenz ruckelt und wirkt wie ein Defekt.
- **Nicht zwischen Frames überblenden.** Bei großen Bildsprüngen erzeugt Alpha
  Schlieren; harter Framewechsel wirkt sauberer.
- Die Weichheit kommt aus dem Lerp der Scrollposition, nie aus Alpha:

```js
L += (ziel - L) * LERP;                       // LERP aus dem Token, nicht literal
zeichne(Math.round(map(L, .02, .80) * (N - 1)));
```

- In einer eigenständigen HTML-Datei **niemals `<video>`** — Bewegung dort immer
  als Canvas-Bildsequenz. Video erst im Repo, wo echte Dateien mit
  Range-Requests ausgeliefert werden.

## Pin-Architektur

**Die Bühne wird gepinnt, animiert wird das Kind.**

ScrollTrigger übernimmt beim Pinnen die Positionierung des gepinnten Knotens
vollständig; eine parallele Transformation wird überschrieben, ohne Fehler-
meldung. Gemessen an `/werkstatt`, festgehalten in `DREHBUCH.md`, umgesetzt in
`src/motion/scrub.ts`.

- Kein `transform` auf einem Element, dessen Position ein Scroll-System verwaltet.
- `ScrollTrigger.refresh()` nach jedem Layoutwechsel, der die Dokumenthöhe
  ändert — Fonts geladen, Bilder eingehängt, Sektion ein- oder ausgeblendet.
- Pin-Container brauchen eine feste Höhe, **bevor** der Trigger erzeugt wird.
  Sonst ist die gemessene Strecke falsch und der Fehler zeigt sich erst eine
  Sektion später.

## Kontinuität statt Umschalten

Ein Übergang zwischen zwei großen Zuständen braucht eine sichtbare Ursache.

- **Eine geteilte Größe** treibt beide Zustände. Zwei unabhängige Timelines
  erzeugen immer ein Umschalten, egal wie gut das Easing ist.
- **Überlappende Zonen**: A wird B über 10–20 % des Fortschritts, statt dass A
  ab- und B einblendet.
- **Erhaltungsgrößen** über die Grenze halten — Position, Skalierung,
  Farbtemperatur, Blickrichtung. Bleibt nichts erhalten, liest das Auge einen Schnitt.

Nie ein Blitzen, ein Blur oder ein Partikelschwall, um einen architektonischen
Bruch zu verdecken. Existiert ein Effekt nur, damit man den Wechsel nicht sieht,
ist die Architektur falsch.

## Leistungsgrenzen

- Nur `transform` und `opacity` animieren. Ein layout-auslösender Wert
  (`top`, `left`, `width`, `height`) in einer Scroll-Schleife kostet auf
  Mobilgeräten die Bildrate.
- `will-change` auf mehr als eine Handvoll Elemente kehrt sich um: mehr
  Speicher, weniger fps.
- Ziel 60 fps auf dem schwächsten Zielgerät, gemessen mit Performance-Panel
  oder rAF-Zähler — nicht am eigenen Eindruck auf einem schnellen Rechner.
- `prefers-reduced-motion` bekommt einen echten Pfad, nicht nur abgeschaltete
  Animation: der Endzustand muss ohne Bewegung erreichbar und vollständig sein.
