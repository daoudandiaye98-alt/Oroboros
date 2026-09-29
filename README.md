# Oroboros Design — KI-Unternehmen aus Köln

Die öffentliche Seite von **Oroboros Design** (https://oroboros-design.com): die Eingangstür
eines KI-Unternehmens mit mehreren Linien — Websites, KI-Sichtbarkeit (Nennbar),
Bewerbungen (Losgeschickt), KI-Video (Bildtakt), KI-Automation, KI-Chat und KI-Inhalte.
Geführt von Daouda Ndiaye, betrieben mit **Angel**, der eigenen KI, die auf der Seite live
berät und über ihre Schnittstelle verkauft.

Eine Seite in zwei Akten:

- **Akt I — die Bühne.** Ein Oroboros aus Bronze in WebGL. Über 900vh fliegt die Kamera einen
  vollen 360°-Umlauf, Schmiedefunken steigen, ein Flüssigbronze-Shader wandert von Bronze
  nach Saphir, und vier Folien tragen je **eine** Aussage, Buchstabe für Buchstabe an den
  Scroll gebunden.
- **Akt II — das Dokument.** Es hebt sich aus der Bühne (die Bühne weicht, dunkelt und
  entsättigt): Kostenlos-Leiste, sieben Abschnitte, jedes Angebot mit Preis und Kaufknopf,
  Angel im Gespräch, Website-Check-Formular.

Kein Build, kein Framework, kein CDN. Vercel liefert die Dateien statisch aus
(`vercel.json`: `framework: null`, `cleanUrls: true`, `trailingSlash: false`).

---

## Was sich in diesem Stand geändert hat

- **Bühne neu gebaut, gleiches Konzept.** Eine einzige Uhr für die ganze Seite, alle
  Glättungen zeitbasiert (`1 − e^(−λ·dt)`) — dieselbe Bewegung auf 30, 60 und 120 Hz. Das
  WebGL-Modul liegt in `vendor/stage.js` und zeichnet nur; three.js (670 KB, 167 KB gzip)
  wird **nur bei echter Grafikhardware** geladen. Pixelmaß gedeckelt (1,5 mobil / 2 Desktop),
  Gütestufen bis zum Halbtakt, Standbild als Rückfall für jeden Fehlerfall.
- **Folien:** Buchstaben und Wörter fahren gestaffelt und scrollgebunden ein und aus, vier
  Kapitelstriche zeigen den Fortschritt, an jedem Kapitelanker ist genau eine Folie lesbar
  (vorher in 10 von 16 Messungen zwei oder keine).
- **Die Naht** zwischen den Akten ist kein Schnitt mehr: Parallaxe, Abdunkeln und
  Entsättigen im Shader, der Text weicht nach oben, der Kopf wird fest hinterlegt.
- **Das Dokument** stellt Oroboros als KI-Unternehmen dar: vier Felder, sieben Linien mit
  14 Kauflinks, Ablauf mit Anzahlung, Angel, Standard und Einwände, Kontakt mit
  Live-Beratung, Empfehlungsprogramm (20 %).
- **Angel-Beratung** als zugänglicher Dialog („Mit Angel sprechen“) — Kopf, Folie 4,
  Angebotskarten, Angel-Abschnitt und Kontakt öffnen ihn.
- **Recht vollständig:** Impressum, Datenschutz (Formular, KI-Chat, Kauf), AGB für alle
  Linien, Widerrufsbelehrung mit Muster-Formular.
- **Sichtbarkeit:** JSON-LD (Organisation, Leistungen und Produkte mit allen Preisen),
  hreflang, canonical, Open-Graph-Bilder je Sprache, `sitemap.xml`, `robots.txt`
  (KI-Crawler ausdrücklich willkommen), `llms.txt`.
- **Prüfstand** (`pruefstand/`): ein Playwright-Audit, das die Aussagen dieser Datei misst,
  ein Server mit den Adressregeln von Vercel und der Generator für die englische Fassung.
- **Fehler behoben**, die das Audit am Vorgänger fand — siehe „Vorher / nachher“.

## Dateien

```
index.html                     die ganze Seite (DE): Stil, Regie, Formular, Angel, Empfehlung
en.html                        englische Fassung — erzeugt, nicht von Hand pflegen (siehe unten)
impressum.html                 § 5 DDG, § 18 MStV, § 19 UStG, KI-Hinweis, alle Marken
datenschutz.html               Hosting, Formular, #beratung (KI-Chat), #kauf (Stripe), Rechte
agb.html                       AGB für alle Linien, inkl. Anzahlungsmodell und Empfehlungen
widerruf.html                  Widerrufsbelehrung und Muster-Widerrufsformular
404.html                       eigene Fehlerseite
robots.txt · sitemap.xml       Crawler, Sprachpaare, Rechtsseiten
llms.txt                       Kurzprofil mit allen Angeboten und Preisen für KI-Assistenten
vendor/stage.js                Akt I in WebGL — nur Zeichnen; Takt und Folien führt die Regie
vendor/three.module.min.js     three.js r160, offizieller Minified-Build, lokal
vendor/fonts/*.woff2           Italiana 400, Outfit 300/400/600, lokal
vendor/img/oroboros-still.webp       Standbild quer (1920×1200), aus der Szene gerendert
vendor/img/oroboros-still-hoch.webp  Standbild hoch (1080×1920) für Telefone
vendor/img/og.jpg · og-en.jpg  Open-Graph-Bilder 1200×630 je Sprache
vendor/img/logo.svg · apple-touch-icon.png
arbeiten/*                     vier Konzeptseiten (HALDEN, LUMEN, Northside, Ridgeline)
pruefstand/audit.mjs           das Audit (Playwright)
pruefstand/server.mjs          Auslieferung wie Vercel (cleanUrls, trailingSlash)
pruefstand/zwilling.py         erzeugt en.html aus index.html
pruefstand/ergebnisse/*.json   vorher.json (Vorgänger), nachher.json (dieser Stand)
.vercelignore                  hält pruefstand/, README und Übergaben von der Domain fern
```

## Lokal starten

```bash
node pruefstand/server.mjs          # http://127.0.0.1:4173/ — Adressen wie auf Vercel
```

`python3 -m http.server 4173` geht auch, kennt aber keine sauberen Adressen: dort gibt es
`/en`, `/impressum` oder `/arbeiten/halden` nicht, nur die `.html`-Dateien.

Schalter in der Adresse (zum Messen und für Standbilder):

| Schalter | Wirkung |
|---|---|
| `?webgl=erzwingen` | rechnet die Bühne auch auf Software-WebGL (SwiftShader, llvmpipe) |
| `?guete=0…5` | hält eine Gütestufe fest (0 hoch … 5 halbtakt), keine Regelung |

---

## Akt I — die Bühne

### Wer was macht

- **Die Regie** (Inline-Skript in `index.html`, Block `══ Regie`) führt eine einzige
  `requestAnimationFrame`-Uhr: geglätteter Scrollwert, Maus, Folien, Kapitel, Naht, Cursor.
  Die Uhr läuft nur, solange sich etwas bewegt, steht bei verborgenem Tab
  (`visibilitychange`) und sobald das Dokument die Bühne ganz verdeckt.
- **`vendor/stage.js`** meldet sich bei der Regie an (`window.OROBOROS.buehne.zeichnen`) und
  zeichnet nur. Beide Seiten (`index.html`, `en.html`) laden dasselbe Modul über
  `import('/vendor/stage.js')`; es importiert `./three.module.min.js`.
- **Reihenfolge beim Laden:** Das Standbild steht sofort (es ist das größte sichtbare
  Element). Eine WebGL-Probe mit `failIfMajorPerformanceCaveat` entscheidet, ob Hardware
  rechnet. Nur dann werden `stage.js` und three.js geladen; die Leinwand blendet über das
  Standbild, sobald das erste Bild steht (`html.buehne-lebt`). Wer direkt auf `/#kontakt`
  einsteigt, bekommt die Szene erst gerechnet, wenn die Bühne wieder ins Bild kommt.
- **Größe:** Die Leinwand misst `100lvh`; ein `ResizeObserver` setzt die Größe nur, wenn sich
  die CSS-Größe wirklich ändert — die ein- und ausfahrende Adressleiste am Telefon löst
  nichts aus.

### Parameter der Regie (`index.html`)

| Name | Wert | Bedeutung |
|---|---|---|
| `GLAETTUNG` | Scroll 3,6 · Maus 3,0 · Cursor 14 (je Sekunde) | `x += (Ziel − x) · (1 − e^(−λ·dt))`, `dt` ≤ 0,1 s |
| `ANKER` | 0 · 0,34 · 0,62 · 0,94 | Kapitelziele — dort steht der Ring frontal (gemessen, s. u.) |
| `FOLIEN` | siehe Tabelle | Auftritt und Abgang je Folie im Bühnenwert s ∈ [0, 1] |
| `STAFFEL` | ein 0,55 · aus 0,35 · Wörter 0,5 | Anteil der Phase, über den sich Buchstaben bzw. Wörter verteilen |
| `WEG` | ein 0,62 em · aus 0,42 em | Hub eines Buchstabens |
| `NAHT_STRECKE` | 0,9 Bildhöhen | vom ersten Blick aufs Dokument bis zur vollen Übernahme |

| Folie | Aussage (DE / EN) | Auftritt | Abgang |
|---|---|---|---|
| 01 Zukunft | Bauen Sie das Morgen / Build tomorrow | steht beim Laden | 0,05–0,12 |
| 02 Sichtbarkeit | Werden Sie genannt / Get named | 0,22–0,29 | 0,39–0,46 |
| 03 Automatik | Geben Sie ab / Hand it off | 0,50–0,57 | 0,67–0,74 |
| 04 Vorsprung | Bleiben Sie vorn / Stay ahead | 0,82–0,89 | bleibt |

Buchstaben kommen mit `easeOutCubic` und gehen mit `easeInCubic`, gestaffelt von links nach
rechts; die Wörter der Beschreibung folgen ab 28 % des Auftritts, die Knöpfe ab 70 %.
Zwischen den Folien ist die Bühne frei — dort hat der Ring seinen Auftritt. Die Buchstaben
liegen während der Bühne auf eigenen Compositor-Ebenen (`will-change`); das senkte die
Bildzeit der Schrift-Choreografie allein von 283 ms auf 16,8 ms (p95, gemessen).
Für Vorleser trägt jede zerlegte Zeile ihren Klartext, die Buchstaben sind `aria-hidden`;
nicht aktive Folien sind `inert`.

**Fortschritt:** vier Kapitelstriche am rechten Rand füllen sich, Nummer und Name folgen
(`aria-current="step"`), ein Klick fährt zum Anker. Der Scroll-Hinweis blendet über die
ersten 3 % aus.

### Parameter der Szene (`vendor/stage.js`)

| Name | Wert |
|---|---|
| `GUETE` | hoch (Pixelmaß ≥ 1,5, überabgetastet) · voll · mittel (×0,85) · spar (×0,72, 320 Funken) · knapp (×0,6, 240 Funken) · halbtakt (wie knapp, Ring jedes zweite Bild); der Grund in ½ bis ¼ Auflösung |
| `START` | 1 = voll |
| `GRENZE` | hinunter bei p90 > 24 ms (Median > 45 ms: zwei Stufen, > 90 ms: direkt Halbtakt) · hinauf (einmal, nur Desktop mit DPR < 1,5) bei p90 < 9 ms · Entscheid nach 45 Bildern oder 1 s, bei Median > 90 ms schon nach 4 Bildern · Aufwärmen 8 Bilder oder 0,35 s · aufgeben bei Median > 50 ms im Halbtakt |
| `DPR_DECKEL` | 1,5 mobil · 2 Desktop |
| `NAHT` | dunkel 0,6 · grau 0,85 · Belichtung 2,2 (bei voller Naht −55 %) |
| `RING` | N 320 · M 28 · R 1,4 · Spanne 0,965 · Schnauze 0,075 |
| `FOLLOW` | k 0,98 · a 0,96 · p 6,152 · c −0,42 (siehe „Warum das Objekt mitdreht“) |
| Licht | Ambient 0,1 · Führung (Spot) 18 bei (4, 6, 3) · Kante `#e3f2ff` 10 bei (−5, 3, −4) · Aufhellung `#fff3e6` 0,8 bei (−2, −4, 2) · keine Schattenkarte |
| Material | Körper `#8a6a44`, Rauheit 0,42, Metall 0,92 · Augen `#1a1210`, 0,15, 1,0 · Tonemapping ACES |
| Funken | bis 450, additiv, Größe 0,025, 60 % Glut / 40 % Saphir, Wirbel mit dem Scrolltempo |
| `WELLEN` | Flüssigbronze-Shader, Zeitskala 0,08, Palette Bronze → Saphir über s, Crest 0,7; in Teilauflösung gerendert und hochgezogen |
| `UMGEBUNG` | gerechnetes Umgebungslicht für die Bronze (siehe unten) |

**Keine Kantenglättung per MSAA.** In schwachen Grafikpfaden verdoppelt MSAA die Bildzeit
(auf SwiftShader gemessen: 23,8 ms je Bild mit, etwa die Hälfte ohne). Die Stufe „hoch“
glättet stattdessen durch Überabtastung — nur dort, wo Luft ist.

### Die Naht

Sobald die Oberkante des Dokuments den unteren Bildrand erreicht, läuft die Naht `n` über
0,9 Bildhöhen von 0 auf 1:

| Was | Verlauf |
|---|---|
| Bühne | weicht um 7 vh nach oben, schrumpft um 5 % (Parallaxe) |
| Folien | Deckkraft `1 − 1,5n`, 14 vh nach oben, ab n > 0,6 `inert` |
| Shader | dunkelt bis 60 %, entsättigt zu 85 %, Belichtung −55 %, Funken verlöschen |
| Raster, Verlauf | blenden aus |
| Kopf | ab n > 0,45 fest hinterlegt (lesbar über beiden Akten) |
| n = 1 | Bühne unsichtbar, die Uhr zeichnet nicht mehr |

Das Dokument trägt an seiner Kante eine Lichtlinie und einen weichen Schatten — als
Verlauf, nicht als `box-shadow`. Ein Schatten über die volle Höhe des Dokuments, ein
animierter Filter und ein Puls unter `backdrop-filter` kosteten im Compositor zusammen bis
zu 830 ms je Bild (Chrome-Tracing); alle drei sind ersetzt.

### Rückfall — jede Störung endet im Standbild

| Fall | Ergebnis |
|---|---|
| `prefers-reduced-motion: reduce` | Standbild, keine Szene, kein three.js; Folien wechseln nur über Deckkraft |
| kein WebGL oder nur Software-WebGL | Standbild, three.js wird nicht geladen, Schrift und Scroll laufen flüssig |
| `stage.js` oder three.js lädt nicht | Standbild |
| auch im Halbtakt zu langsam | Standbild |
| WebGL-Kontext verloren, Ausnahme | Standbild |

Das Audit prüft die Fälle Modul gesperrt, WebGL entzogen und reduzierte Bewegung: Inhalt
vollständig lesbar, keine Fehler in der Konsole.

### Das Licht auf der Bronze: gerechnet statt gebacken

Metall ohne Umgebung spiegelt nur drei Lichter und liest als Schwarz. Der Vorgänger baute
dafür eine PMREM-Umgebung; ihr Abtasten kostete je Bild das 2,6-fache (gemessen: 5,3 statt
14 Bilder/s für den Ring auf SwiftShader). Jetzt rechnet der Shader dieselbe Umgebung
analytisch (`UMGEBUNG`, eingesetzt in `MeshStandardMaterial` über `onBeforeCompile`): zwei
Lichtkeulen (warm, n = 24; kühl, n = 6), Himmel und Boden, Keulen mit der Rauheit verbreitert
(`n' = n / (1 + n·r⁴/2)`, Energie `(n'+1)/(n+1)`). Gegen die PMREM-Fassung gemessen: mittlere
Farbabweichung ≤ 0,2 von 255 Stufen bei s = 0, etwa 2 bei s = 0,34 und 6–9 bei s = 0,62;
die Glanzlichter (95. Perzentil) sind identisch.

### Warum das Objekt mitdreht

Zwischen etwa der Hälfte und zwei Dritteln des Scrollwegs füllte früher ein Körperfragment
das Bild, der Ring war nicht mehr als Ring lesbar. Die Kamera fährt dabei **nicht** durch das
Modell — der kleinste Abstand zur Mittellinie beträgt über den ganzen Pfad 4,19, die
Hüllkugel misst 1,08.

Die Ursache ist geometrisch: Eine Kamera, die ein feststehendes ringförmiges Objekt auf einer
nahezu waagerechten Bahn vollständig umrundet, **trifft zwangsläufig zweimal die Kante** —
die Richtungen senkrecht zur Ringnormalen bilden einen Großkreis, jede Umlaufbahn schneidet
ihn. Kein Parameter ändert das, nur Bewegung. Gemessen mit `__bronze.ring()` (projizierte
Mittellinie gegen den Kreis desselben Durchmessers; 1 = frontal, 0 = Kante) wurde über eine
Wertetabelle (61 Scrollwerte × 180 Drehwinkel) die Nachführung gesucht, die den Ring an
allen vier Ankern zeigt und dazwischen bewusst wegdreht:

```
ψ(s) = c + k·2πs + a·sin(2πs + p)      FOLLOW = { k: 0.98, a: 0.96, p: 6.152, c: −0.42 }
```

| | ohne Nachführung | mit |
|---|---|---|
| kleinste Ringförmigkeit über den Pfad | **0,004** (bei s = 0,78) | **0,454** |
| an den Ankern (0,06 / 0,34 / 0,62 / 0,94) | 0,95 / 0,10 / 0,69 / 0,67 | 0,94 / 0,84 / 0,79 / 0,79 |

`k` nahe 1 heißt: das Objekt dreht mit der Kamera. `a` ist die Wippe, die es an zwei Stellen
um bis zu 55° wegdreht — sonst wäre die Umrundung nicht zu sehen. Die Umrundung tragen
außerdem das feststehende Licht, das einmal um das Objekt wandert, die Kamerahöhe
(0,35 → 1,40) und die Palette des Shaders.

### Warum nur der Scrollwert geglättet wird, nicht die Kamera

Geglättet wird genau ein Wert: der Bühnenscroll `s`. Kamera, Blickpunkt und Objektdrehung
folgen ihm ohne eigene Glättung. Ein zweiter Lerp auf der Kameraposition zöge die Kamera
von der Bahn (sie schnitte die Sehne statt des Bogens) und ließe ihren Azimut hinter der
Nachführung des Objekts herlaufen — gemessen beim Sprung von s = 0 auf 0,35: kleinste
Ringförmigkeit 0,152 mit Positions-Lerp, 0,777 ohne. Weil Kamera und Objekt denselben
geglätteten Wert lesen, ist der eingeschwungene Zustand mit dem Übergang identisch.

### Reduzierte Bewegung

`prefers-reduced-motion: reduce` wird schon im Kopf erkannt (`html.still`, vor dem ersten
Zeichnen): Standbild statt Szene, Bühne 400vh statt 900vh, Folien wechseln nur über
Deckkraft, Auftritte im Dokument sind sofort da, der Ablauf steht gefüllt, Cursor und
Magnet-Knöpfe entfallen, Orb, Scroll-Hinweis und Tippanzeige stehen still, der Dialog
erscheint ohne Bewegung, `scroll-behavior` ist `auto`. Das Audit prüft, dass keine Übergänge
auf Bewegungseigenschaften (transform, translate, scale, rotate, top, left) übrig bleiben.

### Die Messschnittstelle

`window.__bronze` liest den Zustand aus, steuert ihn aber nicht — außer `jump()`:

```js
__bronze.scroll()   // geglätteter Bühnenwert s, 0…1       __bronze.ziel()    // ungeglättet
__bronze.stageH()   // Scrollstrecke der Bühne in px       __bronze.anker()   // Kapitelanker
__bronze.naht()     // 0…1, Übernahme durch das Dokument   __bronze.opacity() // 1 − naht
__bronze.zustand()  // { s, ziel, tempo, naht, maus…, webgl, grund } — grund: warum Standbild
__bronze.work()     // gezeichnete Bilder                  __bronze.guete()   // Stufe, Pixelmaß, DPR
__bronze.camera()   __bronze.project(x, y, z)              __bronze.ring()    // { ringness, span, near }
__bronze.jump(s)    // Kamera, Blickpunkt und Objektdrehung für s sofort setzen
```

---

## Akt II — das Dokument

Über dem ersten Abschnitt: **Kostenlos · ohne Anmeldung** — der Website-Check (Formular,
Befund in 48 Stunden) und der KI-Sichtbarkeits-Check von Nennbar (eine Minute).

| # | Abschnitt | Inhalt |
|---|---|---|
| 01 | Was wir tun | „Ein KI-Unternehmen. Vier Felder.“ — Websites & Design · KI-Sichtbarkeit · KI-Automation & Software · KI-Video & Inhalte; jede Zeile führt zur passenden Karte |
| 02 | Unternehmen | „Jedes Angebot mit Preis.“ — sieben Linien und „Etwas anderes“ (Tabelle unten) |
| 03 | Arbeiten | die vier Konzeptseiten unter `/arbeiten/*` |
| 04 | Ablauf | Beratung → Angebot → Anzahlung (Websites 50 %) → Lieferung in Tagen; die Linie zeichnet sich beim Vorbeiscrollen |
| 05 | Angel | prüft, antwortet, liefert, erinnert — und die Live-Beratung |
| 06 | Standard | vier Prüfbereiche der Übergabe-Prüfliste, dann „Einwände?“ mit elf Antworten |
| 07 | Kontakt | Website-Check-Formular, Angel, WhatsApp, E-Mail, Empfehlung |

Abschnitte treten beim ersten Sichtkontakt auf (IntersectionObserver, einmal); was man
überspringt, per Anker ansteuert oder mit der Tastatur erreicht, ist sofort da. Der Kopf
markiert den gelesenen Abschnitt (`aria-current`). Karten haben ein Hover-Licht, große
Knöpfe eine leichte Magnetik (höchstens 6 px, nur mit feinem Zeiger).

### Angebote und Kauflinks

Jeder Kaufknopf führt zu Angels Kasse:
`https://angel-phi-eight.vercel.app/api/oeffentlich?aktion=checkout&angebot=<schlüssel>&ref=oroboros-website`
(gleicher Tab, `rel="nofollow"`, eigenes `aria-label`).

| Linie | Angebot | Preis | Schlüssel |
|---|---|---|---|
| Oroboros Websites | Website in 48 Stunden — erst Beratung mit Angel, oder direkt | 1.500 € Festpreis, 50 % bei Auftrag | `website_48h` |
| Nennbar | KI-Sichtbarkeits-Check | 0 € | → `/nennbar/` |
| | Paket (24 h) | 199 € | `nennbar_paket` |
| | Einbau durch uns | 99 € | `nennbar_einbau` |
| | Monitor | 39 €/Monat | `nennbar_monitor` |
| | Prüfliste für Agenturen, 100 / 500 Websites | 49 € / 149 € | `nennbar_pruefliste_100` / `_500` (→ `/nennbar/pruefliste/`) |
| Losgeschickt | Beta (7 Tage) · Monat · Plus | 39 € · 79 €/Monat · 129 €/Monat | `losgeschickt_beta` · `_monat` · `_plus` |
| Bildtakt | Auftakt (3 Clips) · Takt (8 Clips im Monat) | 149 € · 299 €/Monat | `bildtakt_auftakt` · `bildtakt_takt` |
| KI-Automation | Starter: ein Workflow mit Übergabe | 990 € | `ki_automation_starter` |
| KI-Chat | Assistent für die eigene Website | 99 €/Monat | `ki_chat_website` |
| KI-Inhalte im Takt | 8 Beiträge im Monat | 149 €/Monat | `ki_content_takt` |
| Etwas anderes | Beratung, danach schriftliches Festpreis-Angebot | auf Anfrage | — (öffnet Angel) |

Alle Preise sind Endpreise (§ 19 UStG). Die Linienseiten liegen bei Angel:
`https://angel-phi-eight.vercel.app/nennbar/`, `/nennbar/pruefliste/`, `/losgeschickt/`,
`/bildtakt/`.

**Empfehlung:** „Empfehlen Sie uns: 20 % vom ersten Auftrag.“ Im Kontakt erzeugt ein kleines
Formular aus Name und Angebot den eigenen Kauflink mit `&ref=<name>` (ohne Netz, ohne
Konto, ohne E-Mail) und kopiert ihn. Die Gutschrift läuft über das `ref`-Feld der Kasse;
geregelt in den AGB.

### Angel — Beratung im Gespräch

Ein `<dialog>`: modal, Fokusfalle, `Esc` schließt, der Fokus kehrt zum Auslöser zurück, auf
dem Telefon bildschirmfüllend, bei reduzierter Bewegung ohne Bewegung. Lange Antworten
stehen ab ihrem Anfang im Bild. Die erste Nachricht steht lokal, ohne Netz:

> Ich bin Angel. Sagen Sie mir in einem Satz, was Sie brauchen — eine Website, Sichtbarkeit
> in KI-Antworten, Automation oder Video.

(Der Auftrag schrieb „Sag mir …“; die Seite siezt durchgehend, deshalb „Sagen Sie mir …“.)

**Vertrag**

```
POST https://angel-phi-eight.vercel.app/api/oeffentlich?aktion=beratung
Content-Type: application/json

{ "text": "…",                       // höchstens 1000 Zeichen
  "sitzung": "…",                    // ab der zweiten Nachricht, aus sessionStorage
  "sprache": "de" | "en",
  "seite": location.pathname,
  "kontakt": { "name": "…", "email": "…" } }   // nur, wenn Angel danach gefragt hat

200 → { "sitzung": "…", "antwort": "…",
        "angebote": [{ "schluessel", "titel", "preis", "link" }],
        "naechsterSchritt": "frage" | "kontakt" | "checkout" | "anfrage",
        "frage": "…" }
429 → „Angel hat gerade viele Gespräche — in ein paar Minuten wieder.“ (Text bleibt im Feld)
Netzfehler, Zeitüberschreitung (30 s), sonst ≠ 2xx → Hinweis und Knopf „Zum Formular“:
      der Dialog schließt, das Gespräch steht als Nachricht im Website-Check-Formular
```

- `angebote` erscheinen als Knöpfe (gleicher Tab, nur `https://`-Ziele); bei `checkout` hell.
- `kontakt` blendet Name und E-Mail ein; beides geht mit der nächsten Nachricht mit.
- `anfrage` bietet das Formular an.
- `sessionStorage`: `oroboros.angel.sitzung`, `oroboros.angel.verlauf` (letzte 40 Einträge) —
  das Gespräch übersteht Seitenwechsel im selben Tab und endet mit ihm.
- Unter dem Eingabefeld: „Angel ist eine KI und kann sich irren“ (Transparenz nach Art. 50
  KI-Verordnung) und der Verweis auf `/datenschutz#beratung`.

### Website-Check-Formular — Vertrag unverändert

```
POST https://angel-phi-eight.vercel.app/api/oeffentlich?aktion=anfrage
{ name, email, website, anliegen, nachricht }
anliegen ∈ website_check | neue_website | software | ki | sonstiges
```

Links mit `data-anliegen` (Kostenlos-Leiste, Folie 4) setzen das Anliegen vor. Ein
unsichtbares Feld (`c-firma`) fängt Bots.

---

## Sichtbarkeit

- `<title>`, Beschreibung, `canonical`, `hreflang` (de, en, x-default → /en), Open Graph und
  Twitter-Karte je Sprache, eigenes Vorschaubild aus der Szene.
- JSON-LD `@graph`: `Organization`/`ProfessionalService` (Anschrift, Kontakt, Inhaber, Fachgebiete),
  `WebSite`, ein `Service` mit `Offer` je eigenem Angebot (Website, Automation, Chat,
  Inhalte) und ein `Product` je Linie (Nennbar, Losgeschickt, Bildtakt) mit allen Preisen —
  14 Angebote, dieselben wie die Kauflinks.
- `sitemap.xml` mit Sprachpaaren; `robots.txt` erlaubt alles und nennt GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended und Applebot-Extended ausdrücklich — wer Sichtbarkeit in
  KI-Antworten verkauft, sperrt die KI-Crawler nicht aus.
- `llms.txt`: Kurzprofil mit allen Angeboten, Preisen und Kontakt (englisch).
- LCP ist das Standbild bzw. die erste Folie; Schriften und Standbild sind vorgeladen, kein
  Skript blockiert das erste Bild.

## Recht

Impressum, Datenschutz, AGB und Widerruf sind vollständig und indexierbar (Stand
29.09.2026): Daouda Ndiaye, Oroboros Design, Eulenbergstraße 22, 51065 Köln,
oroborosdesign@gmail.com; Kleinunternehmer nach § 19 UStG (keine USt-IdNr.); alle Marken
(Oroboros Websites, Nennbar, Losgeschickt, Bildtakt); Hinweis, dass Angel eine KI ist.
Die Datenschutzerklärung beschreibt Formular, KI-Chat (Vercel, Supabase EU, Modellanbieter
Anthropic, Google Gemini, OpenAI), Kauf (Stripe), Benachrichtigung (Resend), Drittländer
und Rechte. Kein Verweis mehr auf die OS-Plattform der EU (seit Juli 2025 abgeschaltet).
**Die Texte sind sorgfältig, ersetzen aber keine Rechtsberatung.**

## Englische Fassung

`en.html` wird aus `index.html` erzeugt:

```bash
python3 pruefstand/zwilling.py
```

Stil und Skripte werden unverändert übernommen; jede Textzeile ist eine Ersetzung mit
erwarteter Anzahl (das Skript bricht ab, wenn eine Zeile nicht genau passt); das JSON-LD wird
englisch neu geschrieben; am Ende warnt das Skript vor deutsch aussehendem Text. **Jede
Änderung an `index.html` → Skript laufen lassen.** Das Audit prüft, dass beide Fassungen in
Stil, Skript, IDs, Feldnamen und Kauflinks übereinstimmen.

---

## Prüfstand

```bash
node pruefstand/audit.mjs --json=pruefstand/ergebnisse/nachher.json
# --basis=https://…      prüft eine Adresse statt des lokalen Servers
# --wurzel=VERZEICHNIS   prüft einen anderen Stand (z. B. git worktree des Vorgängers)
# --nur=seiten,bildzeiten,leistung,reduziert,ausfall,angel,formular,verweise
# --profil=desktop|mobil   --pfad=/|/en   --schnell
```

Braucht Node 22 und Playwright mit Chromium (`PLAYWRIGHT_BROWSERS_PATH`). Ein voller Lauf
dauert etwa 25 Minuten. Geprüft werden `/` und `/en` bei 1440×900 und 390×844 (mobil
emuliert, DPR 3):

- Konsole und Netz: Fehler, Warnungen, Ausnahmen, fehlgeschlagene Anfragen. Meldungen des
  Messaufbaus selbst (SwiftShader-Hinweis, `ReadPixels` für die Kontrastfotos) werden
  getrennt gezählt.
- CLS (Sitzungsfenster), lange Aufgaben nach `load`, Bildzeiten beim Durchscrollen der
  Bühne (p50/p95/p99, Bilder > 50 ms).
- FCP/LCP, Ladegewicht und lange Aufgaben bei vierfach gedrosselter CPU.
- Folien: an jedem der vier Anker genau eine lesbare Folie; Kontrast auf der Bühne aus
  Bildpunkten unter dem Text (5. Perzentil ≥ 4,5:1), im Dokument aus den CSS-Farben.
- Zugänglichkeit: Überschriftenfolge, Alternativtexte, Beschriftungen, sichtbarer Fokus
  (Tab durch die ganze Seite), Fokus nicht unter dem festen Kopf, kein waagerechtes Scrollen,
  keine überstehenden Elemente.
- Reduzierte Bewegung, Ausfall (Modul gesperrt, WebGL entzogen), Angel-Dialog und
  Website-Check gegen ihre Verträge (Schnittstellen gestellt, nichts geht ins Netz), jeder
  interne Verweis samt Unterseiten, Kauflinks nur im Format (ein GET legt bei Angel einen
  Auftrag an), SEO-Dateien, Zwilling.

### Vorher / nachher

Beide Stände mit demselben Messgerät auf derselben Maschine gemessen (29.09.2026, headless
Chromium, WebGL über SwiftShader): der Vorgänger `c13918e` als git worktree über `--wurzel`,
dieser Stand direkt. Rohdaten in `pruefstand/ergebnisse/vorher.json` und `nachher.json`.

| Messung | vorher | nachher | Soll |
|---|---:|---:|---|
| Konsolenfehler und Ausnahmen (/, /en × 2 Geräte) | 0 | 0 | 0 |
| Konsolenwarnungen der Seite | 0 | 0 | 0 |
| Meldungen des Messaufbaus (SwiftShader, Fotos — nicht von der Seite) | 8 | 8 | — |
| Fehlgeschlagene Anfragen (inkl. Unterseiten) | 0 | 0 | 0 |
| CLS (größtes Sitzungsfenster) | 0,124 | 0,001 | ≤ 0,1 |
| Längste Aufgabe nach `load`, Standard, CPU 4× | 5.671 ms | keine | ≤ 200 ms |
| Längste Aufgabe nach `load`, WebGL erzwungen | 3.622 ms | 253 ms | — |
| Bildzeit p95 Desktop 1440×900, Standard | 300 ms | 16,8 ms | ≤ 25 ms |
| Bildzeit p95 Mobil 390×844, Standard | 316,6 ms | 16,8 ms | — |
| Bühne im Standardlauf | WebGL auf SwiftShader | Standbild: kein Hardware-WebGL | — |
| Bildzeit p95 Desktop, WebGL erzwungen (SwiftShader) | 300 ms | 50 ms | — |
| Bildzeit p95 Mobil, WebGL erzwungen (SwiftShader) | 350 ms | 33,4 ms | — |
| Bilder > 50 ms, WebGL erzwungen (4 Läufe) | 103 | 15 | — |
| FCP / LCP Desktop, CPU 4× | 284 / — ms | 420 / 420 ms | FCP < 1500 ms |
| FCP / LCP Mobil, CPU 4× | 276 / 276 ms | 316 / 316 ms | FCP < 1500 ms |
| Ladegewicht `/` ohne Hardware-WebGL (gemessen) | 1.406 KB | 215 KB | — |
| Ladegewicht `/` mit Hardware-WebGL (gerechnet: + stage.js + three.js) | 1.406 KB | ≈ 896 KB | — |
| Kaputte interne Verweise | 0 | 0 | 0 |
| Kauflinks (falsch / gesamt, DE+EN) | 0 / 0 | 0 / 28 | 0 / – |
| Kontrastfehler Dokument / Bühne | 0 / 0 | 0 / 0 | 0 / 0 |
| Überschriften: Sprünge oder h1 ≠ 1 | 0 | 0 | 0 |
| Bilder ohne alt · Felder ohne Beschriftung | 0 · 0 | 0 · 0 | 0 · 0 |
| Fokus ohne sichtbaren Ring | 20 | 0 | 0 |
| Fokus unter dem festen Kopf | 0 | 0 | 0 |
| Waagerechtes Scrollen · überstehende Elemente | 0 · 0 | 0 · 0 | 0 · 0 |
| Anker mit ≠ 1 lesbarer Folie (16 Messungen) | 10 | 0 | 0 |
| Unsichtbar nach dem Durchscrollen | 0 | 0 | 0 |
| Reduzierte Bewegung: Standbild, nur Deckkraft | **FEHLER** | ok | ok |
| Ausfall (Modul gesperrt / kein WebGL) | **FEHLER** | ok | ok |
| Angel-Dialog gegen Vertrag | fehlt | ok | ok |
| Website-Check-Formular gegen Vertrag | ok | ok | ok |
| SEO (Meta, JSON-LD, robots, sitemap) | **FEHLER** | ok | ok |
| Zwilling DE/EN | ok | ok | ok |

- **Standard** heißt: die Seite, wie sie hier ausgeliefert wird. Der Vorgänger rechnete die
  Szene auch auf Software-WebGL und kam so auf 300 ms je Bild; dieser Stand erkennt das und
  zeigt das Standbild. Den Vergleich Szene gegen Szene zeigen die Zeilen „WebGL erzwungen“.
- **FCP ist langsamer geworden** (284 → 420 ms bei vierfach gedrosselter CPU): das HTML trägt
  jetzt sieben Abschnitte, den Dialog und das JSON-LD (139 statt 89 KB). Das größte Element
  steht nach 420 ms (beim Vorgänger meldete Chromium auf dem Desktop kein LCP), und nach
  `load` kommt keine lange Aufgabe mehr — vorher eine von 5,7 Sekunden.
- Die Zeilen mit erzwungenem WebGL schwanken zwischen Läufen (Bilder > 50 ms: 5 bis 15, p95
  Desktop 33 bis 50 ms) — SwiftShader teilt sich die CPU mit dem Browser.

### Was die Zahlen nicht sagen

- **Headless Chromium hat keine Grafikkarte.** WebGL läuft dort auf SwiftShader, also auf
  der CPU. Genau das erkennt die Seite jetzt (`failIfMajorPerformanceCaveat`) und zeigt das
  Standbild — „Standard“ misst die Seite deshalb so, wie sie ein Besucher ohne
  Hardware-WebGL bekommt. Die Zeilen „WebGL erzwungen“ zwingen die Szene trotzdem auf
  SwiftShader: gut für den Vergleich, **keine Aussage über ein echtes Gerät**. Auf jeder
  Grafikkarte ist die Szene um ein Vielfaches schneller; gemessen ist das hier nicht.
- Das Ziel „p95 ≤ 25 ms bei 1440×900“ erfüllt die Seite im Standardlauf (Standbild). Mit
  erzwungener Software-Szene hält die Gütesteuerung den Halbtakt: Schrift und Scroll laufen
  im vollen Takt, der Ring zeichnet jedes zweite Bild.
- Die längste Aufgabe mit erzwungenem WebGL (253 ms) fällt aufs erste Bild (einzeln
  gemessen: 205–263 ms): SwiftShader kennt kein `KHR_parallel_shader_compile` und übersetzt
  die Shader dort im Hauptfaden. Auf Hardware übersetzt der Browser parallel — auch das ist
  hier nicht messbar. Danach regelt die Gütesteuerung binnen etwa einer Sekunde in den
  Halbtakt.
- Beratungs- und Formularschnittstelle werden im Audit gestellt, nicht live angefragt.

## Offen

- `aktion=beratung` bei Angel muss dem Vertrag oben folgen; bis dahin endet jedes Gespräch
  beim Hinweis mit dem Weg zum Formular (geprüft).
- Die Schlüssel `website_48h`, `ki_automation_starter`, `ki_chat_website` und
  `ki_content_takt` müssen in Angels Kasse angelegt sein — live nicht geprüft, weil ein
  Abruf einen Auftrag anlegen würde. Für `website_48h` sagt die Seite: 50 % bei Auftrag,
  der Rest bei Abnahme — die Kasse sollte also 750 € einziehen, nicht 1.500 €.
- Angel sollte `/api/` in ihrer eigenen `robots.txt` sperren; die Kauflinks tragen bereits
  `rel="nofollow"`.
- Echte Geräte: Bildzeiten auf Telefonen und Rechnern mit Grafikkarte sind nicht gemessen.
