# Oroboros Design — Websites zum Festpreis

Die öffentliche Seite von **Oroboros Design** (https://oroboros-design.com). Stand 10.11.2026:
ein Angebot, zwei Festpreise — **Standard-Website 99 €**, **Premium-Website 199 €** — und ein Weg
dorthin: ansehen, buchen, Fragebogen, online.

Kein Build, kein Framework, kein CDN. Vercel liefert die Dateien statisch aus
(`vercel.json`: `framework: null`, `cleanUrls: true`). Produktion folgt `main`.

## Seiten

| Adresse | Datei | Aufgabe |
|---|---|---|
| `/` | `index.html` | Bühne „Das Band“ (WebGL), Preise, Portfolio-Auszug, Ablauf, Zusatzleistungen, Fragen, Kontakt |
| `/buchen` | `buchen.html` | zwei Wahlen (Paket, Zahlung) → ein Link zur Kasse oder zur Rechnung |
| `/portfolio` | `portfolio.html` | diese Seite selbst + die vier Konzeptseiten unter `/arbeiten/*` |
| `/mail/launch` | `mail/launch.html` | die Mail „Launch-Angebot“ im Browser („Im Browser ansehen“) |
| `/impressum` `/datenschutz` `/agb` `/widerruf` | je `.html` | Recht — AGB seit 10.11. mit Standard/Premium und Zahlung auf Rechnung |

`/en` leitet vorläufig auf `/` um (die englische Fassung beschrieb das alte Angebot und ist entfernt).

## Die Bühne — „Das Band“

Eine Welt, ein Vorgang: Der Ring ist ein Tor. Durch ihn läuft ein Band mit Website-Platten.
Hinter dem Tor sind sie **Bauplan** (kühle Linien), davor **fertig** (die echten Seiten aus dem
Portfolio). Die Grenze ist die Ringebene `z = 0` — der Shader liest die Weltkoordinate, nichts
wird umgeschaltet. Am Ende läuft das Band leer, eine helle Platte kommt durch das Tor und füllt
das Bild: **sie ist das Dokument**, das danach weiterläuft. Dunkel → hell hat damit eine Ursache.

- `vendor/regie.js` — eine Uhr: geglätteter Scrollwert `s` (4,2/s), Maus, vier Folien, Zeiger,
  Blende, Kopf, Auftritte im Dokument, Fragen-Formular. Geglättet wird nur `s`; Kamera und Band
  lesen ihn ohne eigene Glättung.
- `vendor/band.js` — zeichnet nur (three.js r160, lokal). Parameter oben in der Datei: `TOR`,
  `BAND`, `KAMERA` (fünf Stationen, Hermite; an Stationen mit `halt` steht die Kamera), `FINALE`,
  `GUETE`.
- Stationen: `s = 0` Angebot · `0,34` Ihre Angaben · `0,62` Der Bau · `0,86` Online · `1` Dokument.
- Hochformat: Kamera weiter weg, Szene oben, Schrift unten (`abstandFaktor`, `setViewOffset`).

**Rückfall — jede Störung endet im Standbild** (`vendor/img/band-still*.webp`, aus der Szene gerendert):
reduzierte Bewegung (`html.still`, three.js wird nicht geladen) · kein WebGL · Modul lädt nicht ·
zu langsam (Median > 70 ms in der kleinsten Gütestufe) · Kontext verloren. In allen Fällen steht
das Angebot mit beiden Knöpfen im ersten Bild.

Schalter in der Adresse (Messen, Standbilder): `?webgl=erzwingen` · `?guete=fest` · `?zeit=0`.
Messschnittstelle: `window.__band` (`s()`, `zustand()`, `platten()`, `springe(s)`).

## Buchung und Kasse

`/buchen` baut aus Paket und Zahlung einen Link zu Angel (`angel.oroboros-design.com/api/oeffentlich`):

| | sofort (Stripe) | auf Rechnung |
|---|---|---|
| Standard 99 € | `aktion=checkout&angebot=website_standard` | `aktion=rechnung_anfordern&angebot=website_standard` |
| Premium 199 € | `aktion=checkout&angebot=website_premium` | `aktion=rechnung_anfordern&angebot=website_premium` |

`?paket=premium` und `?zahlung=rechnung` wählen vor, `?ref=<herkunft>` geht an die Kasse durch
(Standard `oroboros-website`). Ohne JavaScript stehen die vier Links direkt da. Die Angebote
stehen in Angels Katalog (`api/_lib/geld/katalog.ts`) — Preisänderungen dort **und** hier.

## Die Mail

`mail/launch.vorlage.html` (+ `.txt`) ist die Vorlage, `mail/fuellen.py` füllt sie:

```bash
python3 mail/fuellen.py        # neutrale Fassung → mail/launch.html (steht unter /mail/launch)
python3 mail/fuellen.py --anrede "Guten Tag Frau Meyer," --einstieg "…" --ref mail-salon-meyer --aus /tmp/meyer
```

Tabellen, Inline-CSS, 600 px, Systemschriften, Knöpfe als gefüllte Zellen (Outlook über VML),
Dunkelmodus, Klartext-Alternative, Impressum und Abmeldung im Fuß. Absender: `info@oroboros-design.com`.
Kalte Werbe-Mails an Betriebe ohne Einwilligung sind in Deutschland unzulässig (§ 7 UWG) — die Mail
ist für Interessenten und Antworten gedacht, der Grund steht im Platzhalter `{{grund}}`.

## Prüfen

```bash
node pruefstand/server.mjs &     # http://127.0.0.1:4173 — Adressen wie auf Vercel
node pruefstand/audit.mjs        # 134 Kontrollen, ein Exit-Code, Beleg in pruefstand/ergebnisse/audit.json
node pruefstand/audit.mjs --netz # dazu Kasse, Rechnung, Nennbar, Bildtakt über das Netz
```

Das Audit misst: Kontrast der Farbpaare, je Seite × vier Breiten Konsole/Überlauf/h1/Bilder,
Trefferflächen bei 390 px, alle internen Links, die Bühne an jeder Station (genau eine Folie
lesbar, die anderen `inert`), Rad-Scroll bis ins Dokument, drei Rückfälle, die Buchungs-Matrix,
Tastaturfokus, die Mail (Größe, Bilder, Ziele, Pflichtangaben), das Gewicht.

**Nicht messbar und deshalb nicht im Audit:** die Wirkung der Fahrt, die Komposition je Format,
die Bildrate auf echter Grafikhardware (hier nur Software-WebGL). Das braucht ein Auge am Gerät.

## Design-System (`vendor/oro.css`)

Zwei Räume: Nacht `#070818` (Bühne, Premium, Schluss) und Perle `#f4f2ec` (Dokument). **Gold
`#ffb224` ist die Handlung** — nur Knöpfe und Preise tragen es; Eis `#7fdcff` ist der Bauplan.
Schrift: Sora (Anzeige), Outfit (Text), Instrument Serif kursiv (die zweite Stimme). Drei Kurven,
eine Abstandsskala (4 · 8 · 12 · 16 · 24 · 40 · 64 · 104 · 168). Je Ansicht ein goldener Knopf.
