# Optional 24/7 deploy (Oracle Cloud free VM, Fly.io, etc.)
# Upload sahaj_gemma4_q4_k_m.gguf to models/ before build, or mount at runtime.
FROM ollama/ollama:latest

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip3 install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY frontend/dist /app/frontend/dist
COPY models /app/models

ENV OLLAMA_HOST=http://127.0.0.1:11434
ENV OLLAMA_MODEL=sahaj
ENV PORT=8000

COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000 11434
ENTRYPOINT ["/docker-entrypoint.sh"]
