# Backend image for hosts that support long-running Node + headless Chromium
# (Railway, Render, Fly.io, a VPS, etc.). NOT for Vercel — this process must
# stay alive to keep the WhatsApp Web session connected.
FROM node:20-slim

# System libraries required by the Chromium that whatsapp-web.js (Puppeteer) launches.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 wget xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for better layer caching. Puppeteer downloads its Chromium here.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Default port; override with the PORT env var on your host.
EXPOSE 4000

CMD ["node", "server.js"]
