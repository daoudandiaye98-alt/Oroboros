#!/usr/bin/env bash
#
# Prüft alle Quelldateien gegen assets/PRUEFSUMMEN.txt.
#
# Die Zahl steht nicht mehr im Text: sie war „vierzehn", dann kamen mit Phase 2
# sechs Filme dazu, und eine Zahl in einer Meldung, die niemand mitpflegt, ist
# schlechter als keine.
#
# Verglichen werden die ersten 16 Stellen des SHA-256 UND die Größe in Byte.
# `sha256sum -c` kann das Format nicht lesen (gekürzte Summe, zusätzliche
# Spalte), deshalb diese Schleife statt des Standardbefehls.
set -euo pipefail
cd "$(dirname "$0")/.."

fehler=0
anzahl=0
while read -r summe groesse datei; do
  [ -z "${datei:-}" ] && continue
  if [ ! -f "$datei" ]; then
    echo "  FEHLT      $datei"; fehler=1; continue
  fi
  ist_summe=$(sha256sum "$datei" | cut -c1-16)
  ist_groesse=$(stat -c%s "$datei")
  if [ "$ist_summe" != "$summe" ] || [ "$ist_groesse" != "$groesse" ]; then
    echo "  ABWEICHUNG $datei"
    echo "             soll $summe $groesse"
    echo "             ist  $ist_summe $ist_groesse"
    fehler=1
  else
    echo "  ok         $datei  $summe  $groesse"
    anzahl=$((anzahl + 1))
  fi
done < assets/PRUEFSUMMEN.txt

if [ "$fehler" != 0 ]; then
  echo
  echo "Mindestens eine Datei ist nicht die richtige. Abbruch — nicht weiterbauen," >&2
  echo "nichts ersetzen, nichts nachgenerieren. Melden." >&2
  exit 1
fi
echo "Alle $anzahl Quellen stimmen."
