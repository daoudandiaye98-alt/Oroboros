#!/usr/bin/env bash
#
# Holt die Quellfilme der Landing — drei Hauptfilme und drei Rückfahrten.
#
# Der CDN-Pfad ist eine Generierungsablage, keine dauerhafte Adresse. Deshalb
# liegen die geholten Dateien unter Versionskontrolle und dieses Skript ist nur
# der Erstbezug, nicht der Bauweg.
#
# DIE RÜCKFAHRTEN SIND SEIT DEM KONTINUITÄTS-AUFTRAG ZEHN SEKUNDEN LANG.
# Die alten Fünfsekünder sind ersetzt, nicht ergänzt: die Kamera muss so weit
# zurückfahren, dass der Ring JEDES gebrauchte Zielmaß durchläuft. Bei fünf
# Sekunden tat sie das nicht, und der Ausweg war ein Maßstab unter 1 — also ein
# geschrumpftes Bild mit freiem Rand. Genau der ist der Fehler, den dieser
# Auftrag behebt.
#
# Alle sechs sind referenzverriegelt. Weicht eine Prüfsumme ab, ist die Datei
# nicht die richtige: abbrechen und melden. Nichts ersetzen, nichts
# nachgenerieren — sonst wechselt das Tier zwischen den Formaten.
set -euo pipefail
cd "$(dirname "$0")/.."

B="https://d8j0ntlcm91z4.cloudfront.net/user_3FFmfcWYyfOcmhlCAnaEeDIhxeQ"
mkdir -p assets
h () { curl -fsSL -o "assets/$2" "$B/$1"; echo "  geholt: $2"; }

# Die Hauptfilme — unverändert seit dem Qualitätspass.
h hf_20260820_093219_dbd2c715-347e-483f-a9e9-3c8d683fe3f8.mp4 film-3x4.mp4
h hf_20260820_093229_a0fb5a39-701f-4428-9b97-41d27546f439.mp4 film-16x9.mp4
h hf_20260820_093309_bd73a73d-2984-4662-8ceb-3eeef20b7638.mp4 film-9x16.mp4

# Die weiten Rückfahrten — zehn Sekunden, eine Einstellung.
h hf_20260820_155254_b6384ab1-d290-4e28-984e-b51025d13c7e.mp4 rueckfahrt-3x4.mp4
h hf_20260820_155254_db513e5e-7ddf-458a-92fa-6aa0c8fe0179.mp4 rueckfahrt-16x9.mp4
h hf_20260820_155254_dde5c7db-08e9-424f-90f8-fcb468ba6347.mp4 rueckfahrt-9x16.mp4

pruef () {
  x=$(sha256sum "assets/$1" | cut -c1-16); y=$(stat -c%s "assets/$1")
  if [ "$x" != "$2" ] || [ "$y" != "$3" ]; then
    echo "ABBRUCH: $1 weicht ab (ist $x/$y, soll $2/$3)" >&2; exit 1
  fi
  echo "OK  $1  $x  $y"
}
pruef film-3x4.mp4        ecd589fcda776998 68110447
pruef film-16x9.mp4       6fed4be360fe27ea 76595820
pruef film-9x16.mp4       e6ceaf4c509697e0 18209719
pruef rueckfahrt-3x4.mp4  b041c009be89a1f5 11455021
pruef rueckfahrt-16x9.mp4 dc816a6918134202 10452298
pruef rueckfahrt-9x16.mp4 a6d7346e7bd77d26 10228087
