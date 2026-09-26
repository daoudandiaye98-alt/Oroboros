# Übergabe an Code: Arbeiten + Website-Check in oroboros-design.com einbauen

> Auftrag von Daouda, wörtlich:
> „das einzige was noch bleibt ist das aufpolieren diese mockup portfolio award winning websites in die scroll animation dsigns wie von getlayer oder neverland.agency gemischt mit klassichen mehr auf conversion fokjussierte websites wie magistra nach unserem schema eingebaut das heißt du erstellst die und gibst die dateien an code der sie dann in die website einbaut alles jetzt direkt dannn mit villeicht leicht überarbeitetetn texten etc"

Erstellt ist alles. Deine Aufgabe ist nur der Einbau in die bestehende Seite, plus die englische Fassung.

## Ausgangslage

- Repo `daoudandiaye98-alt/oroboros`. Produktion = Zweig **`claude/oroboros-bronze-zeit-hxlzru`** (Vercel-Projekt `oroboros-werk`, Domain oroboros-design.com). `main` ist älter — nicht darauf aufbauen.
- Dieser Zweig (`claude/portfolio-arbeiten`) basiert auf dem Produktionszweig und fügt **nur** den Ordner `arbeiten/` hinzu. `index.html` ist hier noch unverändert.
- Die Live-Seite hat **kein Kontaktformular** (dort steht „Kein Formular an dieser Stelle"). Das Formular kommt mit diesem Einbau.

## Was im Ordner liegt

| Pfad | Was |
|---|---|
| `arbeiten/halden/` | Showcase Architektur (Syne/Inter, dunkel): Loader, Wortmarken-Sandwich, Fensterfahrt, horizontales Projektband |
| `arbeiten/lumen/` | Conversion Beauty (Instrument Serif/Hanken): Vorher-nachher-Wischer im Scroll, Preise mit Rate, Akademie, FAQ, mobile Buchungsleiste |
| `arbeiten/northside/` | Conversion Zahnarzt (Plus Jakarta Sans): Lächeln-Szene (Rahmen öffnet sich), Preise, 3 Schritte mit Linie, Mitgliedschaft, Mini-Terminplaner |
| `arbeiten/ridgeline/` | Conversion Dachdecker (Archivo/Inter): Formular im Hero, Sturm-Scanner über das Dach, Ablauf mit rollender Zahl, Vergleichstabelle |
| `arbeiten/_gemeinsam/` | GSAP 3.15, ScrollTrigger, Lenis 1.3.26, Schriften — alles lokal, kein CDN |
| `arbeiten/vorschau/*.webp` | Je Seite zwei Vorschaubilder (1280×800): Held + Szene |
| `arbeiten/_uebergabe/01-abschnitt-arbeiten.html` | Sektion „Arbeiten" für Akt II, samt CSS und Kopf-/Fuß-Links |
| `arbeiten/_uebergabe/02-abschnitt-kontakt-check.html` | Neue Kontakt-Sektion mit Formular „Kostenloser Website-Check", samt CSS und Skript |
| `arbeiten/_uebergabe/03-texte.md` | Textänderungen Deutsch + komplette englische Fassung |

Jede Konzeptseite ist eigenständig (eine `index.html`), hat `noindex`, ein Schild „Concept by Oroboros Design" (verlinkt auf `/#arbeiten`) und im Fuß „Concept website — fictional …". Alle Pfade sind absolut (`/arbeiten/…`), weil `vercel.json` `cleanUrls` und `trailingSlash: false` setzt — relative Pfade würden unter `/arbeiten/halden` brechen.

## Einbau — Schritte

1. Neuen Zweig vom Produktionszweig ziehen und diesen Zweig hineinmergen (bringt `arbeiten/`).
2. **Sektion Arbeiten:** Inhalt von `01-…html` nach `</section>` von `#leistungen` einsetzen. Die `.tag`-Nummern danach um eins erhöhen (Ablauf 03, Standard 04, Einwände 05, Kontakt 06). CSS-Block in den Stilblock im Kopf. Kopf-Link „Arbeiten" in `.header-actions` vor den Kontakt-Knopf, Fuß-Link in die Liste „Seite".
3. **Kontakt:** Die ganze Sektion `#kontakt` durch die aus `02-…html` ersetzen. CSS in den Stilblock, Skript ans Ende von `setupDocument()` (oder als eigenes Skript vor `</body>` — beides getestet).
4. **Texte:** Tabelle A aus `03-texte.md` übernehmen.
5. **Englisch:** `en.html` als Kopie der fertigen `index.html` anlegen, `lang="en"`, alle Texte aus Teil B. `hreflang`-Links in beide Seiten, Umschalter `DE · EN` im Kopf. Das Formularskript schaltet seine Meldungen über `lang` selbst um. Impressum und Datenschutz bleiben deutsch.
6. Keine neue Abhängigkeit, kein CDN, kein Build-Schritt. Die Seite bleibt statisches HTML.

## Das Formular — was dahinter läuft

- Ziel: `POST https://angel-phi-eight.vercel.app/api/oeffentlich?aktion=anfrage` (JSON).
- Felder: `name`, `email`, `website`, `anliegen` (`website_check|neue_website|software|ki|sonstiges`), `nachricht`, `sprache` (`de|en`), `quelle`, Honigtopf `firma_web`.
- Angel legt die Anfrage als Hinweis in der App an, schickt Daouda eine Mail (Antworten geht direkt an die anfragende Person) und einen Push. 5 Anfragen je Stunde und Adresse.
- Angel nimmt nur die Herkunft `https://oroboros-design.com` und `https://www.oroboros-design.com` an. **Für eine Vercel-Vorschau** deren Adresse in Angels Umgebungsvariable `MARKEN_ORIGINS` eintragen, sonst antwortet die Schnittstelle 403 und das Formular zeigt den Fehlertext.
- Die Aktion `anfrage` ist im Angel-Repo gebaut und getestet, aber erst live, wenn Daouda den Angel-PR freigibt. Bis dahin zeigt das Formular ehrlich: „Das hat nicht geklappt … schreiben Sie an oroborosdesign@gmail.com oder per WhatsApp."

## Abnahme — nichts gilt ohne Beleg

Playwright, Desktop 1440×900 und Mobil 390×844, auf der Vercel-Vorschau:
- [ ] 0 JS-Fehler auf `/`, `/en` und allen vier `/arbeiten/<slug>`
- [ ] Keine 4xx-Antwort, kein Bild ohne Inhalt, kein waagerechter Überlauf
- [ ] Sektion Arbeiten: Karten erscheinen, Hover blendet das Szenenbild ein, jeder Link öffnet die richtige Seite
- [ ] Formular leer abschicken → Prüfhinweis. Ausgefüllt → nach Angel-Freigabe „Danke …", und die Anfrage kommt bei Daouda an (Mail oder Hinweis in Angel). Screenshot davon.
- [ ] Englische Seite: alle sichtbaren Texte englisch, Formularmeldungen englisch
- [ ] Screenshots jeder Sektion ansehen, nicht nur zählen

Dieselbe Prüfung ist hier schon gelaufen (Einbau in eine Probekopie der Produktionsseite, Formular mit nachgestellter Antwort: Erfolg und Fehlerpfad): 0 JS-Fehler, alle Bilder geladen, kein Überlauf.

## Was nicht gebaut wird

- Kein Umbau von Akt I (Bühne, WebGL-Schlange, Slides) außer den Texten aus Tabelle A.
- Keine eigene Portfolio-Unterseite, kein Filter, keine Fallstudien-Texte über die Karten hinaus.
- Keine echten Firmennamen, Logos oder Bewertungen in den Konzeptseiten — sie bleiben als Konzept gekennzeichnet.
- Kein Cookie-Banner nötig: keine Tracker, keine externen Schriften.
- Nicht in Produktion mergen ohne Daoudas „ja".
