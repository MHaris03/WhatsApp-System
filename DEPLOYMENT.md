# Deployment

> **Why not all on Vercel?** Vercel is serverless (short-lived, stateless functions).
> This backend runs a **persistent headless Chromium** (whatsapp-web.js) plus a
> **Socket.IO** server and keeps the login session on disk — none of which work on
> serverless. So: **frontend → Vercel**, **backend → a long-running host**
> (Railway / Render / Fly.io / VPS).

## 1. Backend on Render (free) — uses [`render.yaml`](render.yaml) + [`backend/Dockerfile`](backend/Dockerfile)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick this repo. It reads `render.yaml` and creates
   the `whatsapp-system-backend` web service (Docker, root dir `backend`, free plan).
3. When prompted, set the secret env var **`MONGODB_URI`** = your MongoDB Atlas string.
   (`MONGODB_DB` and `DEFAULT_COUNTRY_CODE` come from `render.yaml`; `PORT` is injected.)
4. Deploy. First build takes a few minutes (it downloads Chromium). Note the public
   URL, e.g. `https://whatsapp-system-backend.onrender.com`.
5. In MongoDB Atlas → **Network Access**, allow `0.0.0.0/0` (Render IPs are dynamic).
6. Connect WhatsApp: open your Vercel frontend (see step 2 below) — the QR appears in
   the **Connect WhatsApp** popup; scan it.

### ⚠️ Free-tier limits (important)
- **Sleeps after ~15 min idle** → WhatsApp disconnects while asleep; the next request
  cold-starts it (~50s). Incoming messages during sleep are missed.
- **No persistent disk on free** → the `.wwebjs_auth/` session is wiped on every
  redeploy/spin-down, so you must **rescan the QR** each time.
- **512 MB RAM** is tight for headless Chromium; it may occasionally restart.
- **Fix for the session loss:** switch from `LocalAuth` to **`RemoteAuth` storing the
  session in MongoDB** (then it survives restarts even without a disk). Ask and I can
  implement it. For always-on without sleep, use a paid plan or an Always-Free VM.

### Other hosts (same Dockerfile)
Railway / Fly.io (paid, always-on + volume) or Oracle Cloud Always-Free VM: create a
service with **root dir `backend`**, the same env vars, and a volume at
`/app/.wwebjs_auth` to keep the session.

## 2. Frontend (Vercel)

Uses [`frontend/vercel.json`](frontend/vercel.json).

1. Import the repo into Vercel, set **Root Directory = `frontend`** (framework auto-detects Vite).
2. Add an environment variable:
   - `VITE_BACKEND_URL` = your backend's public URL from step 1
     (e.g. `https://your-backend.up.railway.app`)
3. Deploy. The app reads `VITE_BACKEND_URL` from [`src/config.js`](frontend/src/config.js)
   for both API calls and the Socket.IO connection.

## Notes
- The backend already allows cross-origin requests (`cors origin: '*'`), so the
  Vercel frontend can reach it. Lock this down to your Vercel domain for production.
- Use `https://` for the backend so the browser doesn't block mixed content.
