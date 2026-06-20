# Deployment

> **Why not all on Vercel?** Vercel is serverless (short-lived, stateless functions).
> This backend runs a **persistent headless Chromium** (whatsapp-web.js) plus a
> **Socket.IO** server and keeps the login session on disk — none of which work on
> serverless. So: **frontend → Vercel**, **backend → a long-running host**
> (Railway / Render / Fly.io / VPS).

## 1. Backend (Railway, Render, Fly.io, or a VPS)

Uses [`backend/Dockerfile`](backend/Dockerfile).

1. Create a new service from this repo, **root directory = `backend`** (Docker build).
2. Set environment variables:
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `MONGODB_DB` — `WhatsApp-System` (optional, this is the default)
   - `DEFAULT_COUNTRY_CODE` — `92` (optional)
   - `PORT` — usually injected by the host automatically
3. Add a **persistent volume/disk mounted at `/app/.wwebjs_auth`** so the WhatsApp
   login survives restarts (otherwise you must rescan the QR after each deploy).
4. Deploy, open the logs, and note the public URL, e.g. `https://your-backend.up.railway.app`.
5. In MongoDB Atlas → **Network Access**, allow your host's IP (or `0.0.0.0/0` for testing).

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
