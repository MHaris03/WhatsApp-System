# Backend image for hosts that support long-running Node + headless Chromium
# (Oracle Cloud VM, Render, Railway, Fly.io, a VPS). NOT for Vercel.
#
# Uses the distro's Chromium (works on BOTH arm64 and x86_64) instead of
# Puppeteer's bundled Chromium — important for Oracle's free ARM instances,
# where Puppeteer has no prebuilt Chromium.
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium and skip its own download.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "server.js"]
