# DREHBUCH

Was beim Bauen aufgefallen ist und beim nächsten Mal von Anfang an gelten soll.
Kein Aufgabenzettel — ein Gedächtnis. Jede Zeile trägt die Fundstelle, an der
sie gelernt wurde.

## Bewegung

**Ein gepinntes Element kann sich nicht selbst bewegen.**
ScrollTrigger übernimmt beim Pinnen die Positionierung vollständig (`position`
und `inset` am Element, ein Abstandhalter davor). Eine parallele Transformation
wird überschrieben. Gemessen an `/werkstatt`: `pin: el` erzeugte den
Abstandhalter korrekt, ließ das Element aber über die ganze Strecke bei
`transform: none` — die Bewegung fand nicht statt, und nichts sagte es. Gepinnt
wird deshalb die **Bühne** (`[data-buehne]`, ersatzweise das Elternelement),
bewegt wird das Kind. Steht in `src/motion/scrub.ts`.

**„Nacheinander" summiert sich.**
Die Rollen laufen der Reihe nach an, nicht gleichzeitig. Für eine Schlagzeile
aus zwölf Wörtern plus vier Karten sind das rund 2,7 s, bis der Container
steht. Bei sechs Sektionen mit je einer Schlagzeile ist das kein Auftritt mehr,
sondern eine Warteschlange. Für Phase 1 zu entscheiden: entweder eine
Überlappung ins Gesetz schreiben (jede Rolle startet, wenn die vorige zur
Hälfte durch ist) oder die Zahl der Rollen je Container hart begrenzen.

**Der Nachzieher zieht auch bei „Bewegung reduzieren" nach.**
`lerp.ts` fragt `ruhig()` nicht ab — bewusst: es ist ein Werkzeug ohne eigene
Meinung, und wer es einsetzt, entscheidet. Für einen Punkt, der dem Zeiger
folgt, ist das aber die falsche Vorgabe: das ist genau die Bewegung, die
jemand mit vestibulärer Empfindlichkeit abstellen will. Die Entscheidung
gehört an die Aufrufstelle, sobald es in Phase 1 einen echten Cursor gibt.

**`.verborgen` trägt nur, solange es HTML gibt.**
Der Vorzustand steht in der Klasse und nicht in einem JavaScript-Nachgriff —
das ist richtig und gemessen (Karten unter der Falz: berechnete Deckkraft 0,
kein Inline-Wert). Aber die Seite wird im Browser gerendert: vor dem Bündel
gibt es überhaupt kein Markup, das aufblitzen könnte. Der volle Nutzen der
Regel kommt erst mit Vorrendern. Das ist derselbe Schritt, der auch 4.5 löst
(siehe unten) — zwei Gründe für dieselbe Entscheidung.

## Prüfstand

**Ein Messgerät, das nicht rollt, misst seinen eigenen blinden Fleck.**
Die 3.9-Kontrolle meldete vier Karten mit `opacity 0` als gefallenes Gate — sie
standen schlicht unter der Falz und ihr Auftritt war nie dran. Gemessen am
19.08.2026 auf 390 und 1280, vier Befunde je Breite. Behoben: die Kontrolle
rollt die Seite erst einmal durch. Die Regel dahinter gilt für jede neue
Kontrolle: **vor dem Messen den Zustand herstellen, den die Kontrolle
behauptet zu messen.**

**Eine Beweis-Seite braucht Abstand.**
Bei 8 rem zwischen den Blöcken stand Block B auf 1280 × 900 schon im ersten
Bild; sein Auftritt war beim Laden vorbei, und die Aufnahme „vorher" zeigte
das Ergebnis. Die 40 vh Polster in `/werkstatt` sind kein Layout, sondern die
Bedingung des Beweises.

## Offen — mit Fundstelle

**4.5 fällt: eine erfundene Adresse antwortet mit 200.**
`vercel.json` schreibt jede unbekannte Adresse auf `index.html` um; für eine
Suchmaschine ist damit jeder Tippfehler eine gültige Seite. Eine Anwendung, die
im Browser rendert, kann den Statuscode nicht setzen. Lösung ist Vorrendern der
bekannten Wege plus eine 404-Regel am Rand — beides gehört in Phase 1 und ist
in Phase 0 bewusst nicht gebaut. Bis dahin ein echter Befund, keine Ausnahme:
`pruefstand/artefakte/bericht.json`, Kontrolle 4.5.

**5.4 fällt: `og:image` und `og:title` fehlen.**
Kein Gate, aber ein Befund. In Phase 0 gibt es keine Bilder — mit dem ersten
Bild kommt auch das Vorschaubild.

**3.10 ist auf allen vier Breiten nicht prüfbar.**
Es gibt keinen primären Knopf außerhalb von Kopf und Navigation, weil es keinen
Weg gibt, auf den die Seite konvertiert. Das ist in Phase 0 richtig so und
wird mit `DER EINE WEG` aus `konzept/FORMULAR.md` von selbst prüfbar.
