#!/bin/sh
set -e
ollama serve &
sleep 3
if [ -f /app/models/sahaj_gemma4_q4_k_m.gguf ]; then
  ollama create sahaj -f /app/models/Modelfile || true
fi
cd /app/backend && exec python3 -m uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
