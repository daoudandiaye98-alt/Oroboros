# Regel · QA

Die Messverfahren und ihre Schwellen. Verwiesen aus `CLAUDE.md`.

Die Zahlen unten sind keine Konvention — sie stehen in
`pruefstand/pruefstand.config.ts` und werden von dort gelesen, nicht hier
gepflegt. Diese Datei erklärt, **was sie bedeuten und wann gemessen wird.**

## Die zwei Arten, und warum sie getrennt bleiben

**Mechanik-QA** ist deterministisch. Sie beantwortet: läuft es, tippt es,
baut es, hält es die Schwellen. Ein Skript kann das.

**Wahrnehmungs-QA** ist prozedural. Sie beantwortet: wirkt der Übergang als
Verwandlung oder als Umschalten. Kein Skript kann das.

**Mechanik grün + Wahrnehmung rot = NICHT FERTIG.** Ohne Verhandlung. Die
Nicht-Automatisierbarkeit ist der Grund für die Prüfung, nicht die
Entschuldigung dafür.

## 1 · Mechanik-Gate

```bash
npm run typecheck            # nur die Typen
npm run build                # tsc -b und Bündel
npm run gesetz               # das Gesetz der drei Kurven, 0 Treffer erwartet
```

Grün ist Voraussetzung, nie Ergebnis. Was nicht existiert, wird als
**übersprungen** ausgewiesen — nie als bestanden. Ein übersprungener Testlauf
in einem Projekt ohne Tests ist ein Befund und gehört in die Statuszeile.

## 2 · Prüfstand

```bash
npm run build && npx vite preview --port 4173 &
npm run pruefstand                              # gegen 127.0.0.1:4173
npm run pruefstand -- --adresse https://…       # gegen die Vercel-Vorschau
PRUEFSTAND_CHROMIUM=/opt/pw-browsers/chromium npm run pruefstand
```

Er misst und schreibt auf. **Er bewertet nicht.** Endet mit Code 1, sobald ein
Launch Gate gefallen ist.

### Lagen

| Lage | Eingabe | Trefferflächen |
|---|---|---|
| 390 × 844 hoch | finger | ja |
| 844 × 390 quer | finger | ja |
| 1280 × 900 | maus | nein |
| 1920 × 1080 | maus | nein |

Dazu zwei Lagen mit „Bewegung reduzieren" (390, 1280). Querformat auf dem
Telefon ist der Fall, in dem `100vh`-Layouts und Kamerafahrten zuerst zerfallen —
es wird nicht weggelassen.

### Schwellen

| Kontrolle | Schwelle |
|---|---|
| 3.3 Kontrast, klein | ≥ 4,5 : 1 |
| 3.3 Kontrast, groß | ≥ 3,0 : 1 |
| 3.3 „groß" ab | 24 px, bzw. 18,66 px ab Schriftgewicht 700 |
| 3.3 Mindestlänge | 2 Zeichen — kürzeres wird nicht gemessen |
| 3.5 Trefferfläche | ≥ 44 px, nur bei Eingabeart „finger" |
| 3.8 Überlappung | ab 25 % der kleineren Fläche |
| 3.8 Überlauf | ab 1 px waagerecht (1 px sind Rundungen) |
| 4.7 Gewicht je Seite | ≤ 3 000 000 Byte |
| Ruhezeit vor dem Messen | 3200 ms |

Kontrast wird **am Bildpunkt** gemessen, nicht im CSS — dort steht nicht die
Wahrheit über das, was der Betrachter sieht.

Die Ruhezeit muss über der längsten Eröffnung der Seite liegen. Heute:
`--dauer-block` 700 ms plus 11 × `--staffel-wort` 100 ms plus vier Karten ≈ 2,7 s,
mit Reserve 3200 ms. **Ändert sich das Auftrittsgesetz, ändert sich diese Zahl.**
Sie ist an die Staffelung gekoppelt, nicht an den Geschmack.

### Launch Gates

3.3 · 3.4 · 3.5 · 3.8 · 3.9 · 4.3 · 4.5 · 4.7

Ein gefallenes Launch Gate heißt **NICHT FERTIG** und wird genannt, nicht
versteckt. Der einzige Weg daran vorbei ist eine eingetragene Ausnahme in
`pruefstand/ausnahmen.ts` — mit Sache, Grund, Verantwortlichem, Termin und
einem **Wecker als ISO-Datum**. Ist der Wecker verstrichen, zählt das Gate
wieder als gefallen. Ein Gate, das ohne Eintrag fällt, ist ein offener Befund,
keine Ausnahme.

### Blindstellen — bekannt, nicht behoben

- **3.4 misst mit `el.focus()`.** Chromium wertet das als Mausfokus, `:focus-visible`
  greift nicht. Ein Ring, der nur über `:focus-visible` kommt, fällt hier durch,
  obwohl die Tastatur ihn zeigt. Im Zweifel in den Stil sehen.
- **3.3 hält Bewegung an, bevor es misst.** Ein Kontrast, der nur während einer
  Blende zu niedrig ist, fällt nicht auf.
- **Ein lokaler Lauf sieht keine Kopfzeilen, Weiterleitungen oder Statuscodes.**
  Er misst denselben Code, aber nicht die Auslieferung. Diese Grenze gehört in
  jeden Bericht, der auf einem lokalen Lauf beruht.

## 3 · Sicht-QA

Screenshots über die Lagen oben, an den Rasterpunkten 0 · 0,25 · 0,5 · 0,75 · 1.

**Zusätzlich jede Übergangsgrenze** — dort bricht es, nicht in der Mitte einer
Sequenz: Materialwechsel, Kamerawechsel, Pin-Start, Pin-Release, Szenenwechsel,
Einblenden von Subjekt oder Typografie.

Danach **jeden Screenshot ansehen**. Ein Screenshot, der erzeugt und nicht
betrachtet wurde, ist kein Beleg, sondern eine Datei.

**Abnahme:** 0 Konsolenfehler · keine Szene zeigt eine leere Fläche · keine
sichtbare Bildkante · Komposition sitzt in jedem geprüften Format.

## 4 · Wahrnehmungs-QA

Läuft **nach** Mechanik und Sicht, nie statt ihrer. Jede Frage wird mit *ja*
oder mit einem konkreten Befund beantwortet — nie mit „wirkt gut".

- Wirkt der Übergang als Verwandlung oder als Umschalten?
- Hat jede Zustandsänderung eine sichtbare Ursache?
- Bleibt die Komposition in jedem Format absichtsvoll?
- Verrät irgendetwas die Implementierung?
- Wirkt etwas billig, künstlich, interpoliert?
- Hielte das ohne Kenntnis des Codes einem Blick von außen stand?

Befunde, die **nur** hier auffallen:

| Befund | Was er verrät |
|---|---|
| Zustand B erscheint, ohne dass A ihn verursacht hat | Umschalten statt Verwandlung |
| Bewegung gleichmäßig über die ganze Strecke | fehlende Beschleunigung, wirkt maschinell |
| Zwei Motive sehen leicht verschieden aus | Assets nicht referenz-verriegelt |
| Etwas ruckt genau an einer Sektionsgrenze | Pin- oder Scroll-Architektur bricht dort |
| Typo erscheint, bevor das Bild steht | Reihenfolge der Reveals nicht komponiert |
| Alles korrekt, nichts einprägsam | generisch — Mutation nötig, kein Bugfix |

## 5 · Belegregeln

Jeder Punkt trägt einen Status: **BELEGT · NICHT BELEGT · N/A**. Es gibt kein
implizites Grün.

- „Der Code müsste stimmen" ist kein Zustand.
- „Desktop geprüft" ist keine Aussage über Mobil.
- Ein Messgerät, das den Zustand nicht herstellt, den es zu messen behauptet,
  misst seinen eigenen blinden Fleck. Vor dem Messen die Seite durchrollen,
  wenn die Kontrolle etwas über Aufgetretenes behauptet.
- Erfundene Verifikation ist der einzige Fehler ohne Wiedergutmachung. Lieber
  „nicht geprüft, weil X fehlt" als ein Haken, der nichts trägt.

Abschlusszeile, immer:

```
STATUS   n offene kritische Punkte · geprüft: … · nicht belegt: …
```
