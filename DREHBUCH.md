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

---

# Landing — was beim Bauen aufgefallen ist

## Zwei Achsen, die nichts voneinander wissen

Die Wortmarke misst **13,4 vw**, die Schnittkante des Z-Sandwichs liegt bei
**41 % der Höhe**. Breite und Höhe sind unabhängig — also war der sichtbare
Anteil des Buchstabens vom Seitenverhältnis abhängig: 46 % auf 390 × 844,
14 % auf 1440 × 900. Auf der breiten Aufnahme standen von OROBOROS nur noch
Bögen über der Kante.

Behoben, indem die Wortmarke an der **Schnittkante** hängt und um einen
Bruchteil der EIGENEN Größe verschoben wird: `bottom: calc(59% - .3em)`.
Damit stehen auf jedem Format dieselben rund drei Viertel über der Kante.

**Die Regel:** wenn zwei Maße aus verschiedenen Achsen kommen, darf ihre
Beziehung nicht in einer dritten Einheit ausgedrückt werden. Eines der beiden
muss das andere als Bezug nehmen.

## Ein Schleier zwischen zwei Ebenen desselben Bildes ist eine Naht

Der Bauauftrag stellt den Schleier auf z2, also zwischen Grund und
beschnittenen Kopf. Dann liegt er nur auf der oberen Hälfte, und an der
Schnittkante steht eine sichtbare waagerechte Linie quer durch das Bild —
dieselbe Fotografie, zweimal verschieden aufgehellt.

Über beide Bildebenen gelegt verschwindet sie. Für die Lesbarkeit der
Wortmarke ändert das nichts: sie steht in beiden Fällen vor dem geschleierten
Himmel.

**Aber:** dabei rutschte der Schleier zuerst auch über den TEXT, und der wurde
mitgedämpft — auf den Aufnahmen als matter Claim und matter Knopf zu sehen.
Die Ordnung muss vollständig hingeschrieben werden, sonst verschiebt jede
Korrektur etwas anderes: Bild → Marke → Vorn → Schleier → Schrift.

## Eine Karte mit Bild oben passt dreimal nicht auf ein Telefon

Hochkant mit Bild oben brauchten die drei Karten rund 960 px bei 844 px
Bildschirm. Die erste war oben abgeschnitten, und statt „erst der Abgang, dann
das Produkt" sah man eine Kartenwand über der Düne. Quer — Bild links, Text
rechts — sind es rund 330 px.

**Die Regel:** eine Karte, die in einer gepinnten Bühne steht, hat ein
Höhenbudget. Es ist der Bildschirm minus das, was das Motiv zeigen soll.

## Der Bauauftrag verlangt zwei Dinge, die zusammen nicht gehen

„Erste Sequenz vollständig geladen unter **4 s bei 4G-Drosselung**" und
„~60 Frames je Sequenz, hochkant **30–45 KB je Frame**". Das sind 1,8 bis
2,7 MB. Bei Lighthouse' „Slow 4G" (1,6 Mbit/s) ist allein die Übertragung von
2,03 MB **10,2 s** — die 4 s sind dort nicht knapp verfehlt, sie sind
unerreichbar.

Gemessen: 14,9 s bei 1,6 Mbit/s, 2,6 s bei 10 Mbit/s (typisches LTE).

Beides steht jetzt im Selbsttest, nebeneinander. Wer die 4 s bei 1,6 Mbit/s
will, muss die erste Sequenz auf rund 700 kB bringen — das sind bei 61 Frames
11 kB je Frame, also deutlich unter der eigenen Vorgabe. Die Entscheidung
gehört dem Auftraggeber, nicht dem Werkzeug.

## Der eigene Ladeschirm stolpert über den eigenen Selbsttest

Der Ladering benutzte dieselbe Klasse `.ring-lauf` wie der Fortschrittsring.
Der Selbsttest griff `document.querySelector(".ring-lauf")` — und bekam den
falschen. Zwei Läufe lang stand „Fortschrittsring am Seitenende offen", während
er in Wahrheit korrekt lief.

**Die Regel:** eine Klasse, an der ein Messgerät hängt, gehört genau einem
Bauteil. Der Ladeschirm hat jetzt `.lade-bahn` / `.lade-lauf` und verschwindet
nach der Blende ganz aus dem DOM.

## Der Prüfstand aus Phase 0 misst eine Landing falsch

Kontrolle 4.7 verlangt 3 MB je Seite. Die Landing IST ein Film: 183 Frames,
und ohne sie gibt es dort nichts zu sehen. Gemessen 8,3 MB quer, 9,6 MB hoch.

Die Schwelle steht jetzt auf 10 MB, und die Zahl, an der die Seite wirklich
hängt — die ERSTE Sequenz — wird im Selbsttest gemessen, gedrosselt, mit der
Zeit bis zur Freigabe. Eine Schwelle, die für den Fall gemacht wurde, den man
gerade nicht hat, ist kein Gate, sondern Rauschen.

---

# Landing, zweite Fassung — der eine Akt

## Drei Bühnen lesen sich wie drei Seiten

Die verworfene Fassung hatte drei gepinnte Akte mit Kapiteltiteln, Karten,
Claim und Fortschrittsring. Jedes Stück für sich war gebaut wie bestellt — das
Ergebnis war trotzdem falsch, weil die Vorgabe „eine Animation beim Scrollen"
lautete und nicht „eine Struktur aus drei Kapiteln".

**Die Regel:** eine Struktur, die aus einer Referenzseite stammt und nicht aus
dem Satz des Auftraggebers, ist geraten. Wenn ein Bauauftrag mehr Gliederung
enthält als die ursprüngliche Bitte, ist die Gliederung der Fehler.

## Ein Messgerät, das den Server falsch nachstellt, misst nichts

`vite preview` liefert unkomprimiert aus. Der Ladezeit-Test maß 341 kB
JavaScript, wo im Netz 61 kB ankommen — 5,4 s statt der tatsächlichen Zeit.
Dazu gab Playwrights `response.body()` die ENTPACKTEN Bytes zurück; erst
`request().sizes()` nennt die übertragenen.

Behoben mit `pruefstand/server.mjs`: statisch, mit gzip, Bilder und Schriften
ausgenommen. Gzip statt Brotli — Vercel liefert Brotli, die Messung irrt
also zur pessimistischen Seite. Das ist die richtige Richtung.

## Eine Bibliothek, die niemand ruft, wiegt trotzdem

Die Landing animiert nichts mit GSAP — ihre ganze Bewegung ist `drawImage`.
Trotzdem lag GSAP mit ScrollTrigger und CustomEase auf ihrem kritischen Pfad,
weil `motion/tokens.ts` die Kurven registrierte und alles `tokens()` liest.

Getrennt: `kurven.ts` hat GSAP, `tokens.ts` liest nur noch Zahlen; die
Werkstatt wird nachgeladen. Kritischer Pfad von 122,9 auf 70,3 kB gzip.

**Die Regel:** eine Datei, die alle importieren, darf nichts importieren, das
nicht alle brauchen.

## Vier Sekunden sind ein Budget für die SEITE, nicht für die Sequenz

Der Auftrag rechnete 685 kB bei 1,6 Mbit/s zu 3,5 s. Durch dieselbe Leitung
kommen aber auch JavaScript, Stylesheet und Schriften — gemessen 125 kB —
plus rund 0,8 s Verbindungsaufbau und Entpacken. Mit der Originalrezeptur
waren es 5,0 s.

Der Auftrag nannte den Hebel selbst: Framezahl oder Breite senken. 4 Bilder je
Sekunde, 420 px, Güte 45 → 482 kB → **3,8 s gemessen**.

## Die Bildpunkt-Messung des Prüfstands kann keine gepinnte Bühne

`page.screenshot` mit einem Ausschnitt in SEITENkoordinaten rollt die Seite
selbst dorthin. In einer scroll-getriebenen Bühne ändert genau dieses Rollen
das Bild — zwischen der Aufnahme mit Text und der ohne steht ein anderer
Frame. Der Vergleich hält die Änderung für Schrift.

Gemessen: die Siegelmarke wurde auf allen vier Breiten mit 1,05 bis 1,09
gegen einen fast weißen Grund gemeldet. Der „Grund" war die eigene Schrift
aus der ersten Aufnahme. An Ort und Stelle sind es 4,11 bis 6,99:1.

Kontrolle 3.3 sagt dort jetzt `nicht_pruefbar` und nennt das Werkzeug, das es
kann. **Die Regel:** ein Messgerät, das etwas nicht messen kann, sagt das —
es liefert keine Zahl, die von der Reihenfolge zweier Aufnahmen abhängt.

## Das Seitenverhältnis des Materials ist eine Entscheidung, keine Einstellung

3:4 auf einem 9:19,5-Telefon: `cover` schneidet **38 % der Breite** weg.
Dieselbe Sequenz auf 1440 × 900: **53 % der Höhe** weg, dazu 3,43×
hochskaliert von 420 px Quellbreite.

Kein Code behebt das. Es braucht Material im Zielformat — genau das, was der
Auftrag mit dem `-l`-Satz bereits vorsieht. Beide Zahlen misst der Selbsttest
jetzt bei jedem Lauf und druckt sie, damit darüber mit Zahlen entschieden
wird und nicht nach Gefühl.

## Backticks in einem Kommentar innerhalb eines Template-Strings

Kosten zehn Minuten und einen Parserfehler an einer Stelle, die mit dem
Kommentar nichts zu tun hat. Im Browser-Code eines `page.evaluate` gibt es
keine Backticks — auch nicht in Prosa.
