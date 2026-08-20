#!/usr/bin/env bash
#
# Holt die sechs Quellfilme der Landing — drei Formatsätze, je Hauptfilm und
# Rückfahrt.
#
# Der CDN-Pfad ist eine Generierungsablage, keine dauerhafte Adresse. Deshalb
# liegen die geholten Dateien unter Versionskontrolle und dieses Skript ist nur
# der Erstbezug, nicht der Bauweg.
#
# Alle sechs sind referenzverriegelt. Weicht eine Prüfsumme ab, ist die Datei
# nicht die richtige: abbrechen und melden. Nichts ersetzen, nichts
# nachgenerieren — sonst wechselt das Tier zwischen den Formaten.
set -euo pipefail
cd "$(dirname "$0")/.."

B="https://d8j0ntlcm91z4.cloudfront.net/user_3FFmfcWYyfOcmhlCAnaEeDIhxeQ"
mkdir -p assets
h () { curl -fsSL -o "assets/$2" "$B/$1"; echo "  geholt: $2"; }

h hf_20260820_093219_dbd2c715-347e-483f-a9e9-3c8d683fe3f8.mp4 film-3x4.mp4
h hf_20260820_093239_b0a7a8f8-1076-495a-b2e4-bd80826f16b6.mp4 rueckfahrt-3x4.mp4
h hf_20260820_093229_a0fb5a39-701f-4428-9b97-41d27546f439.mp4 film-16x9.mp4
h hf_20260820_093247_1e00c19f-04a1-41cd-ad83-11bc2597702b.mp4 rueckfahrt-16x9.mp4
h hf_20260820_093309_bd73a73d-2984-4662-8ceb-3eeef20b7638.mp4 film-9x16.mp4
h hf_20260820_093308_ebee0255-0b29-4664-b2b7-84906cd11106.mp4 rueckfahrt-9x16.mp4

pruef () {
  x=$(sha256sum "assets/$1" | cut -c1-16); y=$(stat -c%s "assets/$1")
  if [ "$x" != "$2" ] || [ "$y" != "$3" ]; then
    echo "ABBRUCH: $1 weicht ab (ist $x/$y, soll $2/$3)" >&2; exit 1
  fi
  echo "OK  $1  $x  $y"
}
pruef film-3x4.mp4        ecd589fcda776998 68110447
pruef rueckfahrt-3x4.mp4  fcc003feb5b5ea4d 26785751
pruef film-16x9.mp4       6fed4be360fe27ea 76595820
pruef rueckfahrt-16x9.mp4 e8ba3c70a212b731 30016982
pruef film-9x16.mp4       e6ceaf4c509697e0 18209719
pruef rueckfahrt-9x16.mp4 88786569f35d6b49  6902621
