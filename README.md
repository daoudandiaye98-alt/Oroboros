# Oroboros Design — Bronze und Zeit

Eine kinematische, scroll-getriebene Landing-Page: ein prozedural erzeugter Oroboros
aus Bronze auf schwarzer Bühne, in WebGL gerendert. Die Kamera fliegt beim Scrollen
eine volle 360°-Umlaufbahn um das Objekt, über eine Seite von 900vh steigen
Schmiedefunken auf, und im Hintergrund atmet ein Flüssigbronze-Wellenshader, dessen
Palette von Bronze oben nach Saphirblau unten wandert. Darüber liegt eine
redaktionelle Ebene: fixierter Kopf, vier Text-Folien mit buchstabenweisem
Unschärfe-Auftritt, ein Vertikalraster mit driftenden Punkten, eine
Stories-Fortschrittsanzeige und ein eigener Doppelring-Cursor.

Kein Build, kein Framework, kein Bundler. Vercel liefert `index.html` statisch aus.

## Dateien

```
index.html                    die komplette Seite, eine Datei
vendor/three.module.js        Three.js r160, lokal — kein CDN
vendor/fonts/*.woff2          Italiana 400, Outfit 300/400/600, lokal — kein Google-Abruf
vendor/img/oroboros-still.webp  Standbild für die Bildmaske von Folie 2, aus der Szene selbst gerendert
vendor/img/og.jpg             Open-Graph-Bild 1200×630, Screenshot der Seite bei Scroll 0
vercel.json                   cleanUrls, kein trailingSlash
```

Die Seite funktioniert vollständig ohne Netz: alle Abhängigkeiten liegen im Repo.

## Lokal öffnen

ES-Module laden nicht über `file://`. Deshalb:

```bash
python3 -m http.server 4173
# dann http://127.0.0.1:4173/
```

## Wo die festen Parameter stehen

Alles liegt in `index.html`, im `<script type="module">`, in dieser Reihenfolge:

| Bereich | Stelle |
|---|---|
| Funken (Anzahl 450, Größe, Farben, Recycling) | `createSparks()` und der Funkenblock in `animate()` |
| Ring-Geometrie (N 320, M 28, R 1.4, Spanne 0.965, Schnauze) | `RING`, `ringPoint()`, `ringRadius()`, `createOuroborosGeometry()` |
| Bronzematerial (roughness 0.42, metalness 0.92), Skalierung 2.15, Neigung, Pivot −0.4 | `buildOuroboros()` |
| Umgebung für das Metall | `createEnvironment()` |
| Wellenshader (Zeitskala 0.08, Frequenzen, Winkel, Palette, Vignette, Crest) | `createBackgroundShader()` |
| Renderer, Tonemapping 2.2, Licht (Key 18 / Rim 10 / Fill 0.8) | `init()` |
| Kameraumlauf, Lerps (Scroll 0.025, Maus 0.05, Cursor 0.2) | `animate()` |
| Folienbereiche und Stories-Fortschritt | `updateSlides()` |
| Navigationsziele `[0, 0.34, 0.62, 0.94]` | `setupNavigation()` |

CSS-Parameter (Titel 116 px Italiana, Fließtext 16 px Outfit 300, 25vw-Raster,
Innenabstand `0 60px 40px 60px`, 900vh) stehen im `<style>` im Kopf der Datei.

## Bewusste Abweichungen vom Bauauftrag

Jede ist gemessen, nicht geschätzt:

- **Umgebung für das Metall.** `metalness 0.92` ohne Umgebung reflektiert nur die drei
  Lichter und liest als Schwarz mit einem Glanzstreifen. Eine prozedurale Umgebung
  (PMREM aus dem Three.js-Kern) macht daraus Bronze. Material-Parameter unverändert.
- **Schnauze und Augen aus der Bahn abgeleitet.** Der Kopf liegt bei `P(0) = (0, −1.4, 0)`;
  die vorgegebene Schnauzenposition `(−0.16, 1.40, 0.40)` lag oben und vor dem Ring.
  Die Schnauze ist jetzt die Fortsetzung des Körpers auf derselben Bahn (`t < 0`),
  die Augen sitzen im Frenet-Rahmen des Kopfes.
- **Crest-Faktor 0.7 statt 1.4.** Bei 1.4 fiel der Kontrast von 10-px- und 16-px-Text
  auf den Glanzbändern unter 4,5:1 (gemessen am Bildpunkt, 11 von 45 Stellen).
- **`uResolution` in Gerätepixeln.** `gl_FragCoord` zählt Gerätepixel; bei DPR 2 saß die
  Vignette sonst im linken unteren Viertel.
- **Trefferflächen 44 px.** Navigation, Kontakt-Knopf und Fußlinks tragen `min-height: 44px`;
  der Kopf hat `padding: 13px 0`, damit seine Kante auf der Trennlinie bei 70 px bleibt.
- **Fußtext 0.62 statt 0.45 Alpha** — 0.45 auf Schwarz ergibt 4,2:1.
- **Titelgröße `min(116px, 8vw)`.** „Geben Sie ab" ist `nowrap`; bei 116 px endet es bei
  1440 px Breite 15 px vor der Kante, bei 1280 oder 1366 px wäre es beschnitten.
- **Reduced Motion zeigt nur die aktive Folie.** Die Vorgabe setzte alle Zeichen auf
  `opacity: 1`, dann stünden vier Titel übereinander. Funken und Shader-Atmung stehen still.
- **Touch ohne Hover** (`hover: none`, `pointer: coarse`) schaltet den eigenen Cursor
  auch über 1024 px ab — sonst hätte ein Tablet im Querformat keinen Zeiger.
- **Unsichtbare `h1`** vor den vier `h2`, damit die Überschriftenhierarchie ohne Sprung ist.

## Noch offen vor einer öffentlichen Schaltung

**Impressum und Datenschutzerklärung fehlen.** Ohne beides darf die Seite in
Deutschland nicht live gehen.
