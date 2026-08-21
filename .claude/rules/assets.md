# Regel · Assets

Erzeugtes Material — Bilder, Sequenzen, Video. Verwiesen aus `CLAUDE.md`.

## Referenzverriegelung — nicht verhandelbar

**Das erste erzeugte Bild ist der Anker.** Jedes weitere Asset entsteht mit
diesem Bild als Referenz (`medias`), nie aus dem Prompt allein.

Ohne Verriegelung wechselt das Motiv zwischen den Szenen, und der Betrachter
sieht sofort zwei verschiedene Tiere. Das ist kein Detailfehler — es zerstört
die Behauptung, dass es eine Welt ist.

Im Prompt benennen, was gleich bleiben muss, wörtlich und aufzählend:
*„same species, same horns, same scale pattern, same eye."*

**Start- und Endbild einer Interpolation:** markante Merkmale müssen in beiden
Bildern auf **derselben Uhrposition** stehen. Das Modell interpoliert den
kürzesten Weg; steht der Kopf im Startbild rechts unten und im Zielbild oben,
rotiert es das ganze Objekt. Geht das nicht: nur ein `start_image` geben und
die Zielform im Prompt beschreiben.

## Prüfsummen

Jedes freigegebene Asset wird mit Prüfsumme registriert. Ein Asset ohne Eintrag
ist kein freigegebenes Asset.

```bash
# beim Freigeben
sha256sum public/assets/<datei> >> .claude/assets.sha256

# vor jedem Lauf, der auf Assets baut
sha256sum -c .claude/assets.sha256
```

Die Prüfsumme belegt zwei Dinge, die sonst niemand sieht:

1. **Der Anker ist noch der Anker.** Ein stillschweigend ausgetauschtes
   Referenzbild bricht die Verriegelung aller Folgeassets auf einmal.
2. **Der geprüfte Stand ist der ausgelieferte Stand.** Eine Sicht-QA gilt für
   die Bytes, die sie gesehen hat, und für keine anderen.

Ändert sich eine Prüfsumme, ist die Sicht-QA für dieses Asset **verfallen** —
nicht „wahrscheinlich noch gültig". Sie wird neu gefahren.

## Nichts nachgenerieren

Ein vorhandenes Asset wird **nicht neu erzeugt**, um einen Fehler wegzubekommen.

Das gilt besonders für den verlockendsten Fall: das Ergebnis sieht nicht ganz
richtig aus, ein neuer Lauf ist billig, also noch einmal. Jeder Nachlauf
erzeugt ein anderes Motiv — die Verriegelung ist damit gebrochen, und der
sichtbare Fehler wandert nur in eine andere Szene.

Erlaubt sind stattdessen:

- **Nachbearbeiten** — freistellen, beschneiden, Alpha nachschneiden, umrechnen.
  Das verändert das Motiv nicht.
- **Neu erzeugen mit dem Anker als Referenz**, wenn die Ursache im Material
  liegt und benannt ist. Danach: neue Prüfsumme, neue Sicht-QA.
- **Die Bewegung umplanen**, wenn das Material die Bewegung nicht trägt
  (siehe Materialtor in `bewegung.md`).

Verboten ist der stille dritte Weg: würfeln, bis es passt. Wer nicht sagen kann,
**warum** der neue Lauf besser ist, hat keinen Grund, sondern Glück.

## Freistellen

`rembg` mit `u2netp` — das große Modell sprengt den Speicher. Danach Alpha hart
nachschneiden, sonst bleibt ein heller Halo:

```python
al = (alpha.astype(float) - 90) * 255.0 / (255 - 90)
alpha = al.clip(0, 255).astype('uint8')
```

## Vor dem Freigeben

- [ ] Mit dem Anker referenz-verriegelt erzeugt
- [ ] Seitenverhältnis passt zum Endgerät, nicht beschnitten
- [ ] Auflösung gegen das Materialtor gerechnet, nicht geschätzt
- [ ] Kanten ohne Halo
- [ ] Prüfsumme in `.claude/assets.sha256`
- [ ] Sicht-QA auf genau diesen Bytes gefahren
