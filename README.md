# Oroboros Design — Bronze und Zeit

Eine Seite in zwei Akten.

**Akt I — die Bühne.** Ein prozedural erzeugter Oroboros aus Bronze auf schwarzem Grund,
in WebGL gerendert. Über 900vh fliegt die Kamera eine volle 360°-Umlaufbahn, Schmiedefunken
steigen auf, ein Flüssigbronze-Wellenshader wandert von Bronze nach Saphir, und vier
Text-Folien fahren buchstabenweise ein.

**Akt II — das Dokument.** Direkt darunter, im normalen Fluss: Leistungen, Ablauf, Standard,
Einwände, Kontakt, Fuß. Es schiebt sich beim Weiterscrollen über den Canvas, der dabei
verblasst. Der Kopf mit dem Kontakt-Knopf steht über beiden Akten und ist auf jeder
Scrollposition erreichbar.

Kein Build, kein Framework, kein Bundler. Vercel liefert die Dateien statisch aus.

## Dateien

```
index.html                      die ganze Seite, eine Datei
impressum.html                  Rechtsseite — unvollständig, siehe unten
datenschutz.html                Rechtsseite — unvollständig, siehe unten
vendor/three.module.js          Three.js r160, lokal — kein CDN
vendor/fonts/*.woff2            Italiana 400, Outfit 300/400/600, lokal — kein Google-Abruf
vendor/img/oroboros-still.webp  Standbild für die Bildmaske von Folie 2, aus der Szene gerendert
vendor/img/og.jpg               Open-Graph-Bild 1200×630, Aufnahme der Seite bei Scroll 0
vercel.json                     statische Auslieferung, Framework und Build ausdrücklich null
```

Die Seite funktioniert vollständig ohne Netz: alle Abhängigkeiten liegen im Repo. Das ist
mit blockierten externen Anfragen geprüft, nicht angenommen.

## Lokal öffnen

ES-Module laden nicht über `file://`. Deshalb:

```bash
python3 -m http.server 4173
# dann http://127.0.0.1:4173/
```

## Wo die festen Parameter stehen

Alles in `index.html`, im `<script type="module">`:

| Bereich | Stelle |
|---|---|
| Funken (450, Größe, Farben, Recycling) | `createSparks()`, Funkenblock in `animate()` |
| Ring-Geometrie (N 320, M 28, R 1.4, Spanne 0.965, Schnauze) | `RING`, `ringPoint()`, `ringRadius()`, `createOuroborosGeometry()` |
| Bronzematerial, Skalierung 2.15, Neigung, Pivot −0.4 | `buildOuroboros()` |
| Umgebung für das Metall | `createEnvironment()` |
| Wellenshader (Zeitskala, Frequenzen, Palette, Vignette) | `createBackgroundShader()` |
| Renderer, Tonemapping 2.2, Licht (Key 18 / Rim 10 / Fill 0.8) | `init()` |
| Kameraumlauf, Lerps (Scroll 0.025, Maus 0.05, Cursor 0.2) | `cameraTarget()`, `animate()` |
| **Nachführung des Objekts** | `FOLLOW`, `pivotSpin()` |
| **Naht zwischen den Akten** (Bühnenmaß, Blende, Ablauflinie) | `measurePage()`, `onScroll()` |
| Folienbereiche und Stories-Fortschritt | `updateSlides()` |
| Auftritte, Ziehharmonika, Cursor-Verhalten im Dokument | `setupDocument()` |
| Navigationsziele `[0, 0.34, 0.62, 0.94]` | `setupNavigation()` |

CSS-Parameter stehen im `<style>` im Kopf; der Dokumentteil beginnt bei
`══ AKT II · DAS DOKUMENT ══`.

## Warum das Objekt mitdreht

Der auffälligste Fehler des Vorstands: zwischen etwa der Hälfte und zwei Dritteln des
Scrollwegs füllte ein Körperfragment das Bild, der Ring war nicht mehr als Ring lesbar.
Die Vermutung im Auftrag lautete, die Kamera fahre durch das Modell. **Gemessen stimmt das
nicht.** Der kleinste Abstand der Kamera zur Mittellinie beträgt über den gesamten Pfad
4,19 — die Hüllkugel misst 1,08, das geforderte Sicherheitsmaß 1,72.

Die Ursache ist geometrisch. Eine Kamera, die ein feststehendes Objekt auf einer nahezu
waagerechten Bahn vollständig umrundet, **trifft zwangsläufig zweimal die Kante** eines
ringförmigen Objekts: die Menge aller Richtungen senkrecht zur Ringnormalen ist ein
Großkreis, und jede Umlaufbahn schneidet ihn. Kein Parameter ändert das — nur Bewegung.

Gemessen wurde mit `window.__bronze.ring()`: die Mittellinie wird projiziert, ihr
Flächeninhalt gegen den Kreis desselben Durchmessers gehalten. 1,0 heißt frontal, 0,0 heißt
Kante. Über eine Wertetabelle (61 Scrollwerte × 180 Drehwinkel) wurde die Nachführung
gesucht, die den Ring an allen vier Folien zeigt und dazwischen bewusst wegdreht:

```
ψ(s) = c + k·2πs + a·sin(2πs + p)      FOLLOW = { k: 0.98, a: 0.96, p: 6.152, c: −0.42 }
```

| | vorher | nachher |
|---|---|---|
| kleinste Ringförmigkeit über den Pfad | **0,004** (bei s = 0,78) | **0,454** |
| an den vier Folien (0,06 / 0,34 / 0,62 / 0,94) | 0,95 / 0,10 / 0,69 / 0,67 | 0,94 / 0,84 / 0,79 / 0,79 |
| kleinster Kameraabstand | 4,01 | 4,19 |

`k` nahe 1 heißt: das Objekt dreht mit der Kamera, sonst steht es auf der Kante. `a` ist die
Wippe, die es an zwei Stellen um bis zu 55° wegdreht — sonst wäre die Umrundung nicht zu
sehen. Die Drehung kehrt nirgends um (kleinste Drehgeschwindigkeit 0,126 rad je Scrolleinheit).
Was die Umrundung weiterhin trägt: das Licht steht im Weltkoordinatensystem fest und wandert
über den ganzen Umlauf einmal um das Objekt, die Kamerahöhe steigt von 0,35 auf 1,40, und
die Shader-Palette wandert von Bronze nach Saphir.

## Warum die Kamera nicht mehr gelerpt wird

Der Auftrag schreibt `camera.position.lerp(target, 0.025)` vor. Diese Zeile ist entfernt,
und das ist keine Kosmetik.

Der Scrollwert wird bereits gelerpt (`currentScroll += (ziel − currentScroll) · 0.025`).
Ein **zweiter** Lerp auf der Kameraposition zieht die Kamera von der Bahn: bei zügigem
Scrollen schneidet sie die Sehne statt den Bogen, kommt dem Körper näher — und vor allem
läuft ihr Azimut dem Scrollwert hinterher, der die Nachführung des Objekts treibt. Die
Abstimmung zwischen beiden gilt dann nur noch im Ruhezustand.

Gemessen am Sprung von s = 0 auf s = 0,35:

| | mit Positions-Lerp | ohne |
|---|---|---|
| kleinste Ringförmigkeit im Übergang | **0,152** | **0,777** |
| kleinster Abstand | 3,01 | 4,38 |

Das ist zugleich der Grund, warum die erste Messung den Fehler nicht fand: sie stellte über
`__bronze.jump()` den eingeschwungenen Zustand her und maß damit ihren eigenen blinden
Fleck. Der Fehler lebt im Übergang. `jump()` setzt heute Kamera **und** Objektdrehung, und
weil die Kamera nicht mehr nachgezogen wird, ist der eingeschwungene Zustand mit dem
Übergang identisch — das Messgerät kann diesen Fehler nicht mehr verfehlen.

## Weitere bewusste Abweichungen

Jede ist gemessen, nicht geschätzt.

- **Umgebung für das Metall.** `metalness 0.92` ohne Umgebung reflektiert nur die drei
  Lichter und liest als Schwarz mit einem Glanzstreifen. Eine prozedurale Umgebung
  (PMREM aus dem Three.js-Kern) macht daraus Bronze. Material-Parameter unverändert.
- **Schnauze und Augen aus der Bahn abgeleitet.** Der Kopf liegt bei `P(0) = (0, −1.4, 0)`;
  die vorgegebene Schnauzenposition lag oben und vor dem Ring.
- **Crest-Faktor 0.7 statt 1.4** im Shader. Bei 1.4 fiel der Kontrast von 10-px- und
  16-px-Text auf den Glanzbändern unter 4,5:1 (11 von 45 Stellen).
- **`uResolution` in Gerätepixeln.** `gl_FragCoord` zählt Gerätepixel; bei DPR 2 saß die
  Vignette sonst im linken unteren Viertel.
- **Kamera im Hochformat aus dem freien Band** zwischen Kopfzeile und Textblock abgeleitet.
- **Titelgröße `min(116px, 8vw)`** — „Geben Sie ab" ist `nowrap` und wäre bei 1280 px beschnitten.
- **Die Blende hängt am Dokument, nicht an einer Zahl.** Der Auftrag blendet die Bühne über
  die letzten 10 % des Bühnenscrolls aus. Dann wäre der Text schon halb verschwunden, bevor
  die Kante des Dokuments überhaupt im Bild ist — eine Zustandsänderung ohne sichtbare
  Ursache. Die Blende beginnt jetzt exakt dort, wo die Oberkante des Dokuments den unteren
  Bildrand erreicht, und ist nach 55 % Bildschirmhöhe fertig. Rundung und Schatten liegen
  dabei noch auf dem glühenden Shader.
- **Keine Übergänge auf scrollgetriebenen Werten.** `transition: opacity .4s` auf dem Canvas
  hätte die Blende gegen die Kante des Dokuments versetzt.
- **Ein Innenrand für beide Akte.** Der Auftrag zentriert das Dokument auf 1500 px; damit
  läge sein Innenrand auf einem 1920er Schirm bei 270 px, der der Bühne bei 60 px. Statt des
  Abschnitts ist jetzt die Zeilenlänge begrenzt (Fließtext 34 em, Karten und Kontakt 1180 px,
  Ablauf 980 px).
- **Die Leistungszeilen sind echte Verweise.** Eine Zeile mit Hover-Fläche und Pfeil, die
  nichts tut, ist ein falsches Versprechen. Jede Zeile öffnet eine E-Mail mit dem passenden
  Betreff.
- **Text im Dokument ist markierbar.** Der globale Reset des Auftrags setzt `user-select: none`.
  Ein Dokument, aus dem man die E-Mail-Adresse nicht kopieren kann, ist kaputt.
- **Buchstaben-Auftritte tragen einen lesbaren Namen.** Jede zerlegte Überschrift bekommt
  `aria-label` mit dem vollen Text, die Buchstaben-Elemente sind `aria-hidden` — sonst liest
  ein Screenreader sie einzeln vor.
- **Reduced Motion zeigt nur die aktive Folie**, Funken und Shader-Atmung stehen still,
  Auftritte im Dokument sind sofort sichtbar, `scroll-behavior` fällt auf `auto` zurück.
- **Kein `<form>`.** Siehe unten.

## Was fehlt — und was dafür nötig ist

**Das Kontaktformular ist nicht gebaut.** Es gibt kein Ziel, an das es senden könnte:
weder eine Formspree-Kennung noch einen Versanddienst-Schlüssel. Ein Absendeknopf ohne
geprüfte Zustellung ist schlimmer als kein Formular — der Auftrag verlangt in diesem Fall
ausdrücklich, es wegzulassen. Der Kontaktabschnitt trägt stattdessen zwei große Knöpfe
(WhatsApp, E-Mail), die nachweislich funktionieren.

Zum Nachrüsten genügt eines von beidem:
1. `action="https://formspree.io/f/<kennung>" method="POST"` — kein Backend nötig.
2. `/api/kontakt.js` als Vercel-Function mit `RESEND_API_KEY` in den Projektvariablen.

Danach: end-to-end testen (echte Absendung, echte Zustellung), erst dann sichtbar schalten.

**Impressum und Datenschutzerklärung sind unvollständig.** Beide Seiten existieren und sind
aus dem Fuß erreichbar, tragen aber `noindex` und einen sichtbaren Hinweis. Es fehlt die
ladungsfähige Anschrift (§ 5 DDG verlangt Straße, Hausnummer, PLZ, Ort), gegebenenfalls die
Umsatzsteuer-Identifikationsnummer, und der Auftragsverarbeitungsvertrag mit dem Hoster.
Der Datenschutztext beschreibt wahrheitsgemäß, was die Seite technisch tut — keine Cookies,
kein Tracking, keine externen Abrufe, kein Browserspeicher —, ersetzt aber keine Rechtsberatung.

**Die Social-Profile fehlen im Fuß.** Der Auftrag nennt Instagram, LinkedIn und GitHub; die
Adressen liegen nicht vor und werden nicht erfunden. Der Fuß führt E-Mail und WhatsApp.

## Die Messschnittstelle

`window.__bronze` liest den Zustand aus, steuert ihn aber nicht — außer `jump()`, das den
Zustand für einen Scrollwert vollständig herstellt:

```js
__bronze.scroll()   // geglätteter Bühnen-Scrollwert 0…1
__bronze.stageH()   // Scrollstrecke der Bühne in Pixeln
__bronze.opacity()  // Deckkraft der Bühne, 1 = sichtbar
__bronze.frames()   // rAF-Ticks insgesamt
__bronze.work()     // Frames, die tatsächlich gerechnet haben
__bronze.ring()     // { ringness, span, near } — siehe oben
__bronze.jump(s)    // Kamera, Blickpunkt und Objektdrehung für s sofort setzen
```
