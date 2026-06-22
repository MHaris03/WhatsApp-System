/**
 * App configuration & filesystem paths.
 * (dotenv is loaded in server.js before this module is required.)
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..'); // backend/

const UPLOAD_DIR = path.join(ROOT, 'uploads'); // transient broadcast/import files
const MEDIA_DIR = path.join(ROOT, 'media'); // persistent chat files (sent + received)
const AUTH_DIR = path.join(ROOT, '.wwebjs_auth'); // whatsapp-web.js session cache

for (const dir of [UPLOAD_DIR, MEDIA_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  PORT: process.env.PORT || 4000,
  ROOT,
  UPLOAD_DIR,
  MEDIA_DIR,
  AUTH_DIR,
  // Country code added to LOCAL numbers (leading 0). Defaults to 92 (Pakistan).
  DEFAULT_CC: (process.env.DEFAULT_COUNTRY_CODE || '92').replace(/[^\d]/g, ''),
  MAX_UPLOAD_BYTES: 64 * 1024 * 1024, // 64 MB

  // ---- Auth / multi-user ----
  JWT_SECRET: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  JWT_EXPIRES: process.env.JWT_EXPIRES || '7d',
  // Max number of users with an ACTIVE WhatsApp session at the same time.
  MAX_ACTIVE_SESSIONS: parseInt(process.env.MAX_ACTIVE_SESSIONS || '3', 10),
};
