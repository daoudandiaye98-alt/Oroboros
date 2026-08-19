# Prüfstand

Portiert aus `pawn-prototype/tools/pruefstand/`. Misst Seiten × Breiten gegen
die ZERA-Kontrollen, schreibt `pruefstand/artefakte/bericht.json` und die
Aufnahmen daneben, und endet mit Code 1, sobald ein Launch Gate gefallen ist.

Er misst und schreibt auf. Er bewertet nicht.

## Lauf

```bash
npm run build
npx vite preview --port 4173 &
npm run pruefstand                                   # gegen 127.0.0.1:4173
npm run pruefstand -- --adresse https://…            # gegen die Vercel-Vorschau
npm run pruefstand -- --breiten 1280,1920            # nur diese Lagen
npm run pruefstand -- --kontrollen 3.3               # Teillauf, druckt alle Zahlen
```

Bringt die Umgebung einen eigenen Chromium mit (Container, CI), zeigt
`PRUEFSTAND_CHROMIUM` darauf:

```bash
PRUEFSTAND_CHROMIUM=/opt/pw-browsers/chromium npm run pruefstand
```

## Der Beleg der Werkzeuge

Der Prüfstand sagt, ob die Seite trägt. Er sagt nicht, ob der Spalter spaltet
oder ob die gescrubbte Bewegung wirklich linear läuft. Dafür gibt es die
Gegenprobe:

```bash
node pruefstand/beleg.mjs pruefstand/artefakte/belege
```

Sie fährt die vier Blöcke von `/werkstatt` einzeln ab, einmal normal und einmal
mit **umgelegtem Schalter** (geklickt, nicht von außen gesetzt), druckt die
Zahlen und legt je zwei Aufnahmen ab. Sie bewertet nichts und endet immer mit 0.

## Ziele

| | |
|---|---|
| Seiten | `/werkstatt` |
| Breiten | 390 hoch · 844 quer · 1280 · 1920 |
| zusätzlich | zwei Lagen mit „Bewegung reduzieren" (390, 1280) |

Die Wurzel steht bewusst nicht in der Liste: sie ist in Phase 0 leer, und eine
leere Seite zu vermessen liefert lauter grüne Zahlen, die nichts aussagen.

## Kontrollen

| | |
|---|---|
| 3.3 | Kontrast (Launch Gate) — am Bildpunkt gemessen, wo CSS nicht die Wahrheit sagt |
| 3.4 | sichtbarer Tastaturfokus (Launch Gate) |
| 3.5 | Trefferflächen ≥ 44 px (Launch Gate) — nur bei Eingabeart „finger" |
| 3.8 | Überlauf, Überlappung, Anschnitt (Launch Gate) |
| 3.9 | „Bewegung reduzieren" nimmt die Bewegung, nicht den Inhalt (Launch Gate) |
| 3.10 | der primäre Knopf im ersten Bild ist nicht verdeckt |
| 4.3 | interne Wege antworten (Launch Gate) |
| 4.5 | erfundene Adresse → 404 mit Weg zurück (Launch Gate) |
| 4.7 | Gewicht je Seite (Launch Gate) |
| 5.1–5.4 | Titel, Beschreibung, Überschriftenfolge, canonical, og |

Weggefallen beim Portieren: `X.dreh` und `X.blatt`. Beide messen Bauteile, die
es nur in PAWN gibt (den Dreh-Hinweis der Heftseiten und das Seitenverhältnis
0,72 einer Doppelseite). Mitgeschleppt hätten sie auf jeder Breite
`nicht_pruefbar` gemeldet — Rauschen, das aussieht wie ein Befund.

## Blindstellen

**3.4 misst mit `el.focus()`.** Chromium wertet das als Mausfokus, also greift
`:focus-visible` nicht. Ein Element, dessen Ring nur über `:focus-visible`
kommt, fällt hier durch, obwohl die Tastatur ihn zeigt. Ein vorheriger
Tab-Druck ändert das nicht (geprüft). Wer 3.4 auswertet, muss im Zweifel in den
Stil sehen: `:focus` ist beweisbar, `:focus-visible` nicht.

**3.3 hält Bewegung an, bevor es misst.** Gemessen wird der ruhende Zustand.
Ein Kontrast, der nur während einer Blende zu niedrig ist, fällt hier nicht auf.

## Wenn der Browser nicht nach außen kommt

In manchen Containern (auch dem, in dem Phase 0 gebaut wurde) erreicht Chromium
das offene Netz nicht, obwohl node es erreicht. Erkennbar an
`net::ERR_CONNECTION_RESET` bei **jeder** Adresse, auch bei `example.com` —
also nicht am Ziel, sondern an der Umgebung. Geprüft am 19.08.2026: mit und
ohne Proxy, mit und ohne `--disable-quic`, mit ignorierten Zertifikatsfehlern,
innerhalb und außerhalb der Sandbox — dieselbe Meldung.

Der Ausweg ist der lokale Lauf gegen `npx vite preview`. Er misst denselben
Code, der veröffentlicht würde, aus demselben Commit — nur ohne die Auslieferung
durch Vercel. Was er damit NICHT sieht: Kopfzeilen, Weiterleitungen, Statuscodes
und alles, was am Rand entschieden wird. Genau diese Grenze muss im Bericht
stehen; ein lokaler Lauf, der als Aussage über die Vorschau ausgegeben wird,
wäre eine Behauptung.

## Dokumentierte Ausnahmen

Keine.

Die Regel, falls je eine dazukommt: eine Ausnahme zählt nicht in den
Rückgabewert, steht aber mit Name und Wecker in der Statuszeile. Der Termin ist
ein Wecker, kein Kommentar — ist er verstrichen, zählt das Gate wieder als
gefallen. Verlängern geht nur bewusst, in `ausnahmen.ts`, mit Commit. Sache,
Grund, Verantwortlich, Termin und Betroffenes gehören dann hierher (ZERA-QA 06).
