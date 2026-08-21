#!/usr/bin/env bash
# Prolog-Quellen. Referenzverriegelt: schlägt eine Prüfsumme fehl, wird
# abgebrochen — nicht ersetzt, nicht selbst erzeugt.
set -euo pipefail
cd "$(dirname "$0")/.."
B="https://d8j0ntlcm91z4.cloudfront.net/user_3FFmfcWYyfOcmhlCAnaEeDIhxeQ/hf_20260820_225327_"
mkdir -p assets
curl -fsSL -o assets/sturm-3x4.mp4    "${B}478f18d9-1b38-40ef-9984-ba6ce207cfa7.mp4"
curl -fsSL -o assets/sturm-16x9.mp4   "${B}8231a586-9028-48a4-a56b-6c4bd24ff573.mp4"
curl -fsSL -o assets/schwenk-3x4.mp4  "${B}bf8aab98-fdbf-4b5a-922c-84f1b08ee795.mp4"
curl -fsSL -o assets/schwenk-16x9.mp4 "${B}91de49a0-9ec6-4a53-804a-ded2aa01d5b2.mp4"

pruef () {
  x=$(sha256sum "assets/$1" | cut -c1-16); y=$(stat -c%s "assets/$1")
  [ "$x" = "$2" ] && [ "$y" = "$3" ] || { echo "ABBRUCH: $1 ist $x/$y, soll $2/$3"; exit 1; }
  echo "OK  $1  $x  $y"
}
pruef sturm-3x4.mp4    cbbc4d8c4f6eee88 4597978
pruef sturm-16x9.mp4   fe09808ef49ba2a7 4658540
pruef schwenk-3x4.mp4  e622aff784d16cce 7266555
pruef schwenk-16x9.mp4 aaf0f6b0aad880ee 8162959
