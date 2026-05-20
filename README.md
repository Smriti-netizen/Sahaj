# Sahaj (सहज)

Offline-first web app for Indian **government scheme discovery** and **legal rights guidance**, powered by **Gemma 4** via **Ollama** (fine-tuned model name: `sahaj` by default).

---

## Prerequisites

1. **Python 3.11+** (3.13 works with the bundled scripts)
2. **Node.js** (for building the frontend)
3. **[Ollama](https://ollama.com/)** installed and running
4. **Fine-tuned model** available in Ollama as **`sahaj`** (or set `OLLAMA_MODEL` to whatever you named it)

Check that Ollama sees your model:

```bash
ollama list
```

Check the API:

```bash
curl http://localhost:8000/api/health
```

You want `"ollama": true` and `"model_loaded": true` once the backend is running.

### Environment variables (optional)

| Variable        | Default                 | Purpose                          |
|-----------------|-------------------------|----------------------------------|
| `OLLAMA_HOST`   | `http://localhost:11434`| Ollama server URL                |
| `OLLAMA_MODEL`  | `sahaj`                 | Model tag in `ollama list`       |

---

## Run the webapp locally

### Option A — Development (hot reload frontend)

Uses Vite on **port 5173** with `/api` proxied to the backend on **8000**.

**Terminal 1 — backend**

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in the browser.

---

### Option B — Production-style (single URL, port 8000)

The FastAPI app serves the **built** React app from `frontend/dist` at the same origin, so you only open **one** port.

**Windows (PowerShell)** — from the repo root:

```powershell
.\scripts\run-production.ps1
```

This script builds the frontend, ensures `backend\.venv` exists, then starts:

```text
http://0.0.0.0:8000
```

Open **http://localhost:8000** on the same machine.

**Manual (any OS)**

```bash
cd frontend && npm install && npm run build && cd ..
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Again, open **http://localhost:8000**.

---

### Voice (mic)

Browser speech recognition works best in **Chrome** or **Edge** with microphone permission granted.

---

## Share the app with others (temporary public URL)

Inference stays on **your** machine: visitors hit a tunnel that forwards to your local port **8000**. Your PC must stay on, awake, and connected to the internet; **Ollama** must keep running.

1. Start Sahaj in **production** mode so everything is on port **8000** (Option B above).
2. In a **second** terminal, run a tunnel:

**Cloudflare Quick Tunnel** (free; URL changes each time unless you set up a named tunnel):

```powershell
.\scripts\start-tunnel.ps1
```

Or manually (after [installing cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)):

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

**ngrok** (free tier has session limits):

```bash
ngrok http 8000
```

Copy the **https** URL and share it. **Do not** commit secrets or expose admin interfaces.

---

## “24/7” availability — what is realistic

Sahaj is designed around **local** Gemma inference. There is no separate cloud API unless you build one. True always-on access means **something** runs continuously.

### 1. Home / office PC (simplest for demos)

- Leave the machine **on**, disable sleep for AC power, keep **Ollama** and **uvicorn** running.
- Use **cloudflared** or **ngrok** with a **named tunnel** + stable domain (Cloudflare Zero Trust or ngrok paid) so the URL does not change every restart.
- **Risk:** power loss, Windows updates, ISP downtime.

### 2. Small VPS or cloud VM (more reliable)

- Rent a small Linux VM with enough **RAM + disk** for your quantized model.
- Install **Ollama**, pull or copy your **`sahaj`** model, clone this repo, build the frontend, run **uvicorn** behind **nginx** (HTTPS).
- Optional: **systemd** units so the API and Ollama restart on reboot.
- **Tradeoff:** user data is no longer “only on their laptop”; it is on **your** server unless you add auth and hardening.

### 3. Dedicated / edge hardware

- A cheap always-on box (NUC, mini PC) at a community center with the same stack as (1), plus a UPS if power is unstable.

### 4. What does **not** give 24/7 by itself

- **Quick Tunnel** URLs from `cloudflared tunnel --url` are ephemeral; they stop when the tunnel process stops.
- **Laptop sleep** kills both Ollama and the tunnel.

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| `503` / “Ollama error” | Is `ollama serve` running? Correct `OLLAMA_HOST`? |
| `model_loaded: false` | Run `ollama pull <name>` or create Modelfile so the name matches `OLLAMA_MODEL`. |
| Blank page on `:8000` | Run `npm run build` in `frontend/` so `frontend/dist` exists. |
| CORS / API errors in **dev** | Use **http://localhost:5173** (proxy), not opening `file://` on `dist`. |
| Voice not working | Use Chrome/Edge; HTTPS or localhost; mic permission. |

---

## License

Add your license here (e.g. MIT, Apache-2.0) if you publish the repo publicly.
