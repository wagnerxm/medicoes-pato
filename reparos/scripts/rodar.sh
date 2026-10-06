#!/usr/bin/env bash
# Regera reparos/dados.js a partir dos PDFs das memórias de cálculo.
# Uso: reparos/scripts/rodar.sh <pasta com os PDFs "N MC.pdf"> [pasta de trabalho]
# Requer: poppler-utils (pdftotext) e Python 3.
set -euo pipefail
PDFS="$1"; W="${2:-/tmp/mc-trabalho}"
D="$(cd "$(dirname "$0")" && pwd)"; DEST="$D/../dados.js"
mkdir -p "$W/txt"
for f in "$PDFS"/*MC.pdf; do b="$(basename "$f" .pdf)"; pdftotext -layout "$f" "$W/txt/$b.txt"; done
cd "$W"
python3 -I "$D/extrair_reparos.py" txt reparos_raw.json | head -1
python3 -I "$D/extrair_trechos.py" txt trechos_raw.json | head -1
python3 -I "$D/extrair_aterro.py" txt aterro_raw.json
python3 -I "$D/montar_dados.py" | tail -4
python3 -I "$D/gerar_dadosjs.py" "$DEST"
