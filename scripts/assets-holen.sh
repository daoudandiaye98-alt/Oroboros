#!/usr/bin/env bash
#
# Holt die vierzehn Quelldateien der Landing.
#
# Der CDN-Pfad ist eine Generierungsablage, keine dauerhafte Adresse — er kann
# jederzeit verschwinden. Deshalb liegen die geholten Dateien unter
# Versionskontrolle und dieses Skript ist nur der Erstbezug, nicht der Bauweg.
#
# Schlägt eine Prüfsumme fehl, ist die Datei nicht die richtige: abbrechen und
# melden. Nichts ersetzen, nichts nachgenerieren — die Referenzverriegelung des
# Tieres geht sonst verloren und das Motiv wechselt zwischen den Akten.
set -euo pipefail
cd "$(dirname "$0")/.."

B="https://d8j0ntlcm91z4.cloudfront.net/user_3FFmfcWYyfOcmhlCAnaEeDIhxeQ"
mkdir -p assets/hoch assets/quer

hol () { curl -fsSL -o "$2" "$B/$1"; echo "  $2"; }

echo "Hochformat 3:4"
hol hf_20260819_214719_43cf6725-a9ce-4f8a-b8bb-cc5a3579ece9.png assets/hoch/hero.png
hol hf_20260819_214719_d99cf434-dccd-4c18-b4b2-f9ef71849884.png assets/hoch/trav.png
hol hf_20260819_214719_7566f489-4fce-42f3-b3a1-e50c1cf3b4fc.png assets/hoch/coil.png
hol hf_20260819_214719_0b9d70ce-69a5-4650-ace6-5e0e14037674.png assets/hoch/ring.png
hol hf_20260819_221714_fca402f0-f417-4584-ab29-69e4424da966.mp4 assets/hoch/einroll-quelle.mp4
hol hf_20260819_214906_171595c2-cd4d-4c18-97ec-df63c7a4bb0c.mp4 assets/hoch/traverse-quelle.mp4
hol hf_20260819_214907_3b378335-e715-4c50-84a2-96d0574f0fc3.mp4 assets/hoch/kopf-quelle.mp4

echo "Querformat 16:9"
hol hf_20260819_223302_febf8515-81f4-40d2-bdad-a1e775d981d9.png assets/quer/hero.png
hol hf_20260819_223302_3f52d16e-fa60-4de1-b262-4ce87cbc7502.png assets/quer/trav.png
hol hf_20260819_223302_fdb8366c-809d-420d-8f0e-e576c3e29d9c.png assets/quer/coil.png
hol hf_20260819_223302_9d537b2a-d41e-447b-82bf-0a1558fdd12e.png assets/quer/ring.png
hol hf_20260819_223405_c70e6271-fd58-4751-be7c-5f359cb82dd3.mp4 assets/quer/einroll-quelle.mp4
hol hf_20260819_223405_2494738c-5da3-4898-9ddc-a22838627efa.mp4 assets/quer/traverse-quelle.mp4
hol hf_20260819_223405_42c111b7-5846-4ffd-b695-3bfba3b73215.mp4 assets/quer/kopf-quelle.mp4

echo "Prüfsummen"
scripts/pruefsummen.sh
