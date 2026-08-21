# CLAUDE.md

Der Kern. Alles Ausführliche steht in `.claude/rules/`; jede Aussage lebt an
genau einer Stelle. Stack, Befehle und Ordnung: `README.md`. Was beim Bauen
gelernt wurde: `DREHBUCH.md`. Was vorher feststehen muss: `konzept/FORMULAR.md`.

## Die sieben Sätze

**Ursache vor Pflaster.** Die Frage lautet nie „wie mache ich den Fehler weg",
sondern „welcher Zustand erzeugt ihn". Ein Fehler, der nicht reproduziert wurde,
wurde auch nicht behoben. Tritt dasselbe Symptom zum zweiten Mal auf, ist nicht
der Fix falsch, sondern die Architektur — dann wird die Ebene gewechselt, nicht
der Patch verfeinert.

**Architektur vor Umgehung.** Kein zusätzlicher Effekt, um einen Bruch zu
verdecken. Existiert etwas nur, damit man den Wechsel nicht sieht, wird es
entfernt und die Ursache behoben.

**Materialprüfung vor Umsetzung.** Auflösung, Seitenverhältnis, maximale
Skalierung und Overscan werden ausgerechnet, bevor die erste Zeile entsteht.
Trägt das Material das Ziel nicht: STOP, Grenze benennen. Kein `scale()`, kein
`overflow: hidden`, kein Kaschieren.

**„Fertig" heißt gebaut, gelaufen, angesehen, geprüft.** Vier Zustände, nicht
einer. „Der Code müsste stimmen" ist keiner davon.

**Mechanische QA und Wahrnehmungs-QA sind getrennt und beide Pflicht.** Die eine
ist Maschine, die andere ist Auge. Mechanik grün und Wahrnehmung rot heißt NICHT
FERTIG — ohne Verhandlung. Dass Wahrnehmung sich nicht automatisieren lässt, ist
der Grund für die Prüfung, nicht die Entschuldigung dafür.

**Vor jedem Bericht ein Selbsttest im echten Browser, mit angesehenen
Screenshots.** Playwright liegt im Container, es gibt keine Ausschussgründe. Ein
Screenshot, der erzeugt und nicht betrachtet wurde, ist kein Beleg, sondern eine Datei.

**Nie behaupten, was nicht gemessen wurde.** Jeder Punkt trägt BELEGT, NICHT
BELEGT oder N/A. Desktop geprüft ist keine Aussage über Mobil. Lieber „nicht
geprüft, weil X fehlt" als ein Haken, der nichts trägt. Erfundene Verifikation
ist der einzige Fehler ohne Wiedergutmachung.

## Die Regeln

| Datei | wofür sie zuständig ist |
|---|---|
| `.claude/rules/bewegung.md` | Sequenzen, Overscan, Framewahl, Pin-Architektur, kein `scale()` als Reparatur |
| `.claude/rules/assets.md` | Referenzverriegelung, Prüfsummen, nichts nachgenerieren |
| `.claude/rules/qa.md` | die Messverfahren, die Schwellen, die Launch Gates, die Belegregeln |
| `.claude/rules/react.md` | wo React aufhört und das rAF anfängt |

## Vor der ersten Zeile

Ab „mehrere Komponenten, ein System" wird erst gelesen, dann modelliert, dann
gebaut: **INTENT → PERCEPTION → SYSTEM → MATERIAL → IMPLEMENT → POLISH**.
Verboten ist der Sprung REQUEST → CODE. Ein funktionierendes System wird nicht
angefasst, weil es möglich wäre, sondern nur mit Beleg, dass es falsch ist.
