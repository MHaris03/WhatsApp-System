# WhatsApp System — Free File Sender + Two-Way Chat

A simple web UI to **broadcast files/messages to many numbers** AND **chat
two-way** with single or many users (live, real-time).
**100% free** — no Twilio, no Meta Business API, no paid subscription.

Two tabs:
- **📢 Broadcast** — paste many numbers, attach a file, send to all at once.
- **💬 Chat** — WhatsApp-style conversations. Pick a number (or many separate
  threads), send text/files, and see incoming replies arrive live with image,
  video, audio and document previews.

It works by automating **WhatsApp Web** through the open-source
[`whatsapp-web.js`](https://wwebjs.dev/) library. You log in **once** by scanning
a QR code with your phone, exactly like using WhatsApp Web in a browser.

```
WhatsApp-System/
├── backend/    Node.js + Express + whatsapp-web.js + Socket.IO   (port 4000)
└── frontend/   React (Vite)                                       (port 5173)
```

## Requirements
- Node.js 18+ (you have v20 ✅)
- A phone with an active WhatsApp account (to scan the QR)

## Setup & Run

### 1. Backend
```powershell
cd E:\WhatsApp-System\backend
npm install      # first run downloads a headless Chromium — be patient
npm start
```
Leave it running. It listens on http://localhost:4000

### 2. Frontend (new terminal)
```powershell
cd E:\WhatsApp-System\frontend
npm install
npm run dev
```
Open the printed URL (http://localhost:5173).

### 3. Use it
1. The page shows a **QR code**. On your phone: WhatsApp → **Linked Devices** →
   **Link a device** → scan it.
2. Status turns to **Connected**.
3. Paste phone numbers (with country code, e.g. `923001234567`), separated by
   comma / space / new line.
4. Type a message and/or attach a file.
5. Click **Send**. You get a per-number sent/failed report.

## Notes & limits
- Numbers must include the **country code**, no `+`, `00`, spaces or dashes
  needed (the backend strips them anyway). Example: `14155552671`.
- The backend sends sequentially with a ~1.5s gap and skips numbers that
  aren't on WhatsApp.
- This is unofficial automation. **Don't spam.** Sending bulk unsolicited
  messages can get your number banned by WhatsApp. Use it for opt-in / known
  contacts only.
- Your login session is cached in `backend/.wwebjs_auth` so you don't rescan
  every restart. Use the **Log out** button to reset.

## Free, no API keys
Everything here (Express, React, Vite, Socket.IO, whatsapp-web.js, bundled
Chromium) is free and open source. There is nothing to buy.
