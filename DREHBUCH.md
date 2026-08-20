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

---

# Qualitätspass am Hero

## Freigabezeit und Bildschärfe waren dieselbe Zahl

Solange eine einzige Sequenz beides entscheiden musste, war jede Verbesserung
der einen eine Verschlechterung der anderen: um unter vier Sekunden
freizugeben, musste die Güte auf 45 und die Breite auf 420 px — und damit war
das Bild dauerhaft unscharf.

Zwei Stufen lösen das. Der **Vorlauf** (jeder vierte Frame, klein und grob)
entscheidet, WANN freigegeben wird. Die **volle Stufe** entscheidet, WIE
SCHARF es ist, und strömt danach im Hintergrund nach; sie ersetzt die Frames
einzeln im selben Array, während gescrollt wird.

Der Trick, damit dabei nichts stockt: der Vorlauf füllt die Lücken zwischen
seinen Stützen mit der jeweils letzten Stütze. Das Array ist also von der
ersten Sekunde an VOLLSTÄNDIG — es gibt keinen leeren Platz. Gemessen: 2,6 s
bis zur Freigabe bei 1,6 Mbit/s statt 3,8 s, bei besserem Bild.

**Die Regel:** wenn zwei Anforderungen an derselben Zahl hängen und
gegeneinander ziehen, ist nicht die Zahl falsch, sondern dass es eine ist.

## Eine Breite ist bei zwei Seitenverhältnissen nicht dasselbe Gewicht

480 px Vorlaufbreite ergeben bei 16:9 129k Bildpunkte je Frame und 179 kB;
bei 3:4 sind dieselben 480 px 309k Bildpunkte und 427 kB. Der Vorlauf steht
deshalb je Satz: 480 px für 16:9, 360 px für 3:4.

## Der Canvas-Deckel muss BEIDE Achsen decken

Ich hatte ihn mit `Math.max` der beiden Achsverhältnisse geschrieben. Damit
das `cover` nicht hochskaliert, muss die Quelle aber beide Achsen tragen —
die bindende ist die knappere, also `Math.min`. Gemessen auf 390 × 844: mit
`max` gab der Deckel Dichte 2,0 frei, der Canvas wurde 780 × 1688, und das
828 × 1108 große Bild musste um 1,52 gedehnt werden. Mit `min`: Dichte 1,31,
Canvas 512 × 1108, Faktor 1,00.

Der Boden bei 1 bleibt: unter die CSS-Auflösung wird nie gegangen. Das würde
die Vergrößerung nur vom Canvas in den Compositor verschieben und die
Messzahl schönen, ohne ein Detail zu gewinnen.

## Überblenden war nicht falsch, sondern nur bei 110 px falsch

Das alte Verbot galt für Bildsprünge über 100 px Scrollweg — zwei so weit
auseinanderliegende Bilder halb übereinander ergeben Doppelbilder. Bei 100
Frames auf 300 svh sind es 14 px, und dieselbe Blende glättet die Stufen,
statt Schlieren zu erzeugen.

**Die Regel:** eine Verbotsregel gehört an ihre Bedingung geschrieben, nicht
an ihren Gegenstand. „Nie überblenden" war zu kurz; „nicht überblenden, wenn
die Nachbarbilder weit auseinanderliegen" ist die Regel.

## Zwei Grenzen, die kein Code aufhebt

**Seitenverhältnis:** 3:4 füllt ein 9:19,5-Display nicht — 38 % der Breite
fallen weg. 16:9 auf 1440 × 900 fällt von 53 % auf 11 %, weil es jetzt echtes
Querformatmaterial gibt. Für das Telefon fehlt derselbe Schritt: ein
9:16-Satz.

**Quellauflösung:** 1284 px Quellbreite auf einem 1440 px breiten Fenster
sind 1,26× Vergrößerung, und daran ändert kein Encoder etwas. Auf 1600 px zu
skalieren macht die Datei 31 % größer und erfindet die Differenz. Echte
Auflösung kommt nur aus echtem Hochskalieren der QUELLE.

# Phase 2

## Die Zahl im Auftrag stimmte — sie stand nur am falschen Frame

Der Bauauftrag nennt den Ring des Schlussbildes mit 0,570 (hoch) und 0,523
(quer) der Bildbreite und schreibt dazu „gemessen am letzten Frame der
Rückfahrt". Am letzten Frame gemessen sind es 0,2342 und 0,0746. Der Faktor
zwischen Auftrag und Material ist 2,4 beziehungsweise 7,0 — bei einem so
groben Unterschied liegt der Verdacht auf einem Tippfehler nahe, und ein
Tippfehler wäre nicht zu klären gewesen.

Er war keiner. Am ERSTEN Frame der Rückfahrt misst der 3:4-Satz senkrecht
0,5692, der 9:16-Satz waagerecht 0,5310. Das sind die 0,570 und die 0,523.
Die Beschriftung der Zeile war falsch, nicht die Messung — und weil eine
Rückfahrt genau das tut, wonach sie heißt, ist der Ring am Ende kleiner.

**Die Regel:** eine Zahl, die um ein Vielfaches danebenliegt, ist selten
falsch abgeschrieben. Meistens ist sie richtig gemessen und falsch
beschriftet. Wer sie nur meldet, verliert die Information; wer sucht, wo sie
stimmt, findet die Stelle — und weiß danach, was gemeint war.

## Ein Maßstab über 1 ist keine Gestaltung, sondern ein Materialfehler

Das Lockup braucht den Ring bei 0,229 der Fensterbreite. Was der Film davon
liefert, entscheidet, ob die Verwandlung verkleinern darf oder vergrößern
muss — und Vergrößern heißt Hochrechnen, ausgerechnet am schärfsten Moment
der Seite.

Gemessen auf 1440 × 900 mit dem alten 16:9-Satz: Ring 120 px, gebraucht 330,
Maßstab 2,74. Die beiden Hochformate lagen bei 0,98 und 0,96 — sie stimmten,
weil ihre Rückfahrten weniger weit zurückziehen. Die 16:9-Fahrt zieht nach
5,04 s bis auf ein Siebtel der Fensterbreite zurück; bei 0,80 s steht der
Ring bei 0,243, also genau am gebrauchten Maß.

Die Lösung war deshalb kein Code, sondern ein Zeitbereich im Bauskript:
`rueckDauer: 0.80` für 16:9, 50 Frames aus der ersten Sekunde statt aus fünf.
Gleiche Aufnahme, gleiches Gewicht, richtiger Ausschnitt der Fahrt.

**Die Regel:** wo eine Kette aus Material, Bauskript und Laufzeitcode ein
Maß verfehlt, ist die billigste Stelle fast nie der Laufzeitcode. Ein
`Math.min(1, …)` als Kappung gehört trotzdem dorthin — nicht um zu
korrigieren, sondern damit ein künftiger Materialwechsel auffällt, statt
still unscharf zu werden.

## Der Ring musste den Buchstaben finden, nicht der Buchstabe den Ring

Wo im Wort das erste O steht, weiß erst der Umbruch: die Breite von
„ROBOROS" hängt an der geladenen Schrift, und die Zeile ist mittig. Also
wird der freigelassene Kasten GEMESSEN und das Bild danach ausgerichtet —
statt beide aus derselben Formel zu rechnen und zu hoffen, dass sie
dieselbe bleibt. Der Selbsttest misst am Ende 0,0 px Abweichung in beiden
Ansichtsgrößen; das ist kein Zufall, sondern die Bauart.

Zweimal ging es dabei schief, und beide Male auf dieselbe Weise: eine
Messung, die den eigenen vorigen Eingriff mitmisst. Erst die Zeile, die mit
noch anliegender Verschiebung vermessen wurde (der Ring saß 121 px unter
seinem Buchstaben), dann der Canvas, dessen `getBoundingClientRect` bereits
verwandelt zurückkommt. Beide Male half derselbe Griff: vor dem Messen
zurücksetzen, oder einen Bezug wählen, den der Eingriff nicht anfasst.

## Senkrecht schwenkt das Bild nicht, sondern der Satz

Der Ring sitzt in der Bildmitte, im Wort steht er links — waagerecht muss
das Bild also wandern. Senkrecht müsste es nicht, und tat es doch: das
Ergebnis war ein geschrumpftes Rechteck in der linken oberen Ecke, mit
Sandbändern rechts UND unten. Es sah aus wie ein Fehler im Umbruch.

Umgekehrt stimmt es: das Bild bleibt senkrecht mittig, die Textspalte rückt
dorthin, wo der Ring danach steht. Die Bänder liegen dann oben und unten
gleich hoch, und es bleibt eine einzige senkrechte Kante.

**Die Regel:** wenn zwei Dinge zusammenfinden müssen, bewegt man das, dessen
Bewegung nichts kostet. Eine Textspalte kann überall stehen. Ein Bild, das
sich verschiebt, gibt seinen Rand her.

## Eine Farbe, die man schreibt, ist beim nächsten Farbdurchgang falsch

Die Fläche neben dem geschrumpften Schlussbild — auf 1440 × 900 sind es 39 %
der Breite — braucht einen Sandton. Er wird nicht geschrieben, sondern aus
dem Film gelesen: aus der rechten Spalte des letzten Frames, weil die Naht
dort verläuft. Gemessen an der Naht rgb(178,144,100) im Bild gegen
rgb(178,146,101) in der Füllung.

Zwei Umwege lagen dazwischen. Das Mittel des ERSTEN Frames war deutlich
satter — Frame 1 ist die tiefstehende Sonne, Frame 150 die Aufsicht am
Mittag. Und das Mittel über alle vier Kanten zog der Schatten der Kuhle nach
unten. Die Probe muss von der Stelle kommen, an der sie anliegt.

## Zwei richtige Entscheidungen ergeben zusammen eine falsche

Phase 2 nahm die flächige Abdunklung weg und stellte den Text im Schlussbild
auf dunkel — beides richtig, beides gemessen (11,1:1 statt der geforderten
4,5:1). Im Ruhemodus läuft aber keine Bühnenschleife, und deshalb blieb dort
der Schleier stehen, dessen untere Kante zu 88 % schwarz ist. Genau dort
stand jetzt dunkler Text. „DESIGN" war fast unsichtbar.

Gefunden hat es kein Prüfstand: Steuerung 3.3 meldet innerhalb gepinnter
Bühnen `nicht_prüfbar`, weil ihre Aufnahme die Seite selbst verschiebt.
Gefunden hat es eine Aufnahme, die angesehen wurde. Die Messung kam danach —
als eigener Durchgang im Selbsttest, damit sie beim nächsten Mal zuerst
kommt.

**Die Regel:** wo ein Zweig eine Voraussetzung nicht teilt, erbt er auch
ihre Aufhebung nicht. Jede Bedingung, die ein Zweig anders hat, ist eine
eigene Messung wert.

## Ein Canvas ist ein ersetztes Element

`position: absolute; inset: 0` streckt einen Canvas nicht. Er hat eine
Eigengröße von 300 × 150, und bei `width: auto` gewinnt sie. Die Staubfläche
lag als 300 × 150 großes Feld in der linken oberen Ecke, und der Übergang
spielte dort statt in der Mitte. `width: 100%; height: 100%` dazu — dieselbe
Zeile, die bei `.ebene` aus demselben Grund steht.

# Kontinuität und Kamera-Architektur

## Ein Maßstab, der ein Bild kleiner macht als sein Fenster, ist keine Gestaltung

Phase 2 brachte den Ring auf sein Zielmaß, indem sie das ganze Bild schrumpfte
und den frei werdenden Rand mit dem mittleren Sandton füllte. Beides stand so
im Auftrag, und beides war falsch — die Füllung war die sichtbare Kante, und
ROBOROS lief in sie hinein.

Die Ursache ist eine Verwechslung von Kamera und Objektiv. Eine Kamera wählt
einen Ausschnitt; sie macht das Bild nicht kleiner. Was sie darf, ist innerhalb
dessen zu wandern, was `cover` ohnehin abschneidet — der Overscan-Reserve. Alles
darüber hinaus legt Fläche frei, und jede Füllung dieser Fläche ist ein
Pflaster auf einem architektonischen Fehler.

**Die Regel:** wenn eine Transformation Fläche freilegt, ist nicht die Füllung
zu verbessern, sondern die Transformation zu ersetzen. Die Größe kommt aus der
WAHL DES FRAMES, nicht aus einem Faktor.

## Die Bedingung des Auftrags war unerfüllbar, und das Nachrechnen sagte es

§3 verlangte, den Ring an den linken Rand zu schwenken, mit der Bedingung
`|schwenk| + 2 <= overscanX`. Nachgerechnet mit den gemessenen Ringdaten:

| Fenster | overscanX | nötiger Schwenk |
|---|---|---|
| 1440 × 900 | 87 px | −540 px |
| 844 × 390 | 0 px | −284 px |

Der Ring sitzt über die ganze Rückfahrt bei cx ≈ 0,51 — in der Bildmitte. Ihn
an den Rand zu bringen heißt, eine halbe Fensterbreite zu schwenken. Der im
Auftrag vorgesehene Ausweg (ein früherer Frame) hilft nicht, weil cx sich über
die ganze Fahrt nur um 0,06 ändert.

Umgedreht geht es: nicht der Ring geht zum Wort, sondern das Wort zum Ring.
Gewählt wird der früheste Frame, bei dem die ganze Zeile ins Fenster passt.

**Die Regel:** eine Bedingung, die in keinem Zielfenster erfüllbar ist, ist
keine Anforderung an die Umsetzung, sondern ein Fehler in der Anforderung. Sie
wird nachgerechnet und benannt, bevor eine Zeile entsteht — nicht durch eine
Näherung ersetzt, die niemand geprüft hat.

## Ein Schwellwert kann Schlange und Sand nicht trennen — eine Form kann es

Der Auftrag gab ein Messverfahren vor: Graustufen, Schwelle Median − 9, größte
zusammenhängende Region. Es misst die Kuhle mit ihrem Außenschatten, mit einem
Fehler, der über die Fahrt von 4 auf 51 % wächst, und ab 9,0 s greift es einen
Dünenschatten am anderen Bildrand.

Der Grund steht im Material: Körper rgb(228,186,122), Sand rgb(215,176,121).
Was den Ring auszeichnet, ist keine Helligkeit, sondern eine FORM — ein heller
Kranz um eine dunkle Mitte. Genau darauf antwortet der Detektor jetzt, und der
Fehlerfall verschwindet, ohne dass eine Sonderregel nötig wäre.

**Die Regel:** wenn zwei Dinge im gemessenen Kanal identisch sind, hilft kein
besserer Schwellwert. Dann ist der Kanal falsch gewählt.

## Das Suchfenster ist die eigentliche Messung

Mit ±16 % Radiusspielraum rastete der Detektor ab Frame 66 auf die
sonnenbeschienene Sichel IM Ring um — dieselbe Form, halb so groß. Kein
Absturz, keine Warnung, nur eine falsche Zahl. Die Fahrt schrumpft 2,8 % je
Frame; ein Fenster von 0,93 bis 1,01 schließt den Halbierungssprung aus.

**Die Regel:** ein Verfolger, der mehr zulässt, als die Physik hergibt, ist
kein robuster Verfolger, sondern ein Zufallsgenerator mit Vorgeschichte.

## Zwei Größen, die gegeneinander eintauschbar sind, gehören nicht in dieselbe Suche

Mitte und Radius gemeinsam zu optimieren verbesserte die Mitte und
verschlechterte den Durchmesser: die Kantenantwort lässt sich auch dadurch
erhöhen, dass der Kreis kleiner UND verschoben wird. Abwechselnd verfeinert
kommt jeder Schritt aus einer Frage.

## Der Schnitt lag nicht dort, wo der Auftrag ihn vermutete

Gesucht wurde ein Bruch zwischen Staub und Film. Gemessen war der Bruch die
ÜBERGABE: der Staub lag in einer festen Ebene über der Bühne, der Schleier der
Bühne darunter. Beim Aushängen der Ladeszene legte sich der Schleier
schlagartig über das Bild — 41 bis 47 Stufen von 255 in einem Schritt.

Der Staub gehört in die Bühne, unter den Schleier. Dann gilt für ihn dieselbe
Abdunklung wie für das Bild danach, durchgehend.

**Die Regel:** ein Übergang zwischen zwei Zuständen bricht dort, wo die beiden
Zustände in verschiedenen Ebenenordnungen leben. Nicht die Blende reparieren —
die Ebenen zusammenlegen.

## Wann die letzte Zelle aufgeht, entscheidet über die Rate — nicht die Kurvenform

Die Enthüllungsrate war dreimal zu hoch, und dreimal lag es an derselben Sache:
die Maske war schon vor dem Ende der Zeitachse fertig, und der ganze Weg
drängte sich in den Rest. Nacheinander gefunden:

- Faktor 1,0: verrauschte Zellen erreichten nur 0,48 Deckkraft — das Bild wurde
  nie voll undurchsichtig, und die Übergabe sprang.
- `dichte² · 1,7`: Sättigung bei 0,83.
- `dichte · 1,85`: Sättigung bei 0,63 — schlechter, nicht besser.
- Kornzuschlag mit Gewicht 1: der Staub deckt nach dem Setzen JEDE Maskenzelle
  fünffach, der Zuschlag galt also überall und halbierte den Weg noch einmal.

Richtig ist, den Faktor so zu wählen, dass die verrauschteste Zelle GENAU bei
`dichte = 1` aufgeht, und den Kornzuschlag klein zu halten.

**Die Regel:** bei einer geschwellten Auflösung bestimmt nicht das Easing die
Rate, sondern der Abstand zwischen der ersten und der letzten Schwelle.

## Eine Prüfung, die sich selbst misst, prüft nichts

Die Helligkeitsprüfung analysierte jede Aufnahme sofort im Browser. Auf
1440 × 900 kamen so in fünf Sekunden vier Proben zustande — der gemeldete
„Schritt über 120 ms" umfasste 500 ms. Und die Bildratenmessung lief während
der Aufnahmeschleife, in der `page.screenshot()` den Hauptfaden anhält: 28 statt
55 Bilder je Sekunde.

Dazu drei Prüfungen, die das Falsche fanden:

- „dunkelster Bildpunkt 11" war nicht der Seitenhintergrund, sondern ROBOROS —
  die Schrift steht in genau dieser Farbe.
- „Rand ohne Textur" war der Schleier, der dort absichtlich fast schwarz ist.
- Die Texturschwelle 1,2 stammte aus einem Vergleich, in dem die FÜLLUNG mit
  1,79 über dem echten Bild mit 1,52 lag. Sie hat nie getrennt, was sie
  trennen sollte.

**Die Regel:** jede gefallene Prüfung wird zuerst gegen sich selbst geprüft.
Miss sie, was sie behauptet? Erst danach wird am Gegenstand geändert.

## Kein Messwert hat das Raster gemeldet

Helligkeit, Bildrate, Kantentextur, Kontrast — alles grün, während über der
Düne ein grobes Rechteckraster lag, weil die Maskenzellen acht Bildpunkte breit
waren und hart schalteten. Gesehen hat es die Aufnahme, nicht die Zahl.

**Die Regel:** Mechanik grün heißt nicht fertig. Es heißt, dass man jetzt
hinsehen darf.
