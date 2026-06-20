/**
 * WhatsApp System — Backend entry point.
 * Free WhatsApp tool using whatsapp-web.js (WhatsApp Web). No paid API.
 *
 *   1. Broadcast: send a file/message to MANY numbers at once.
 *   2. Chat: two-way conversations with single or many users (live, real-time).
 *
 * Layout:
 *   src/config      env + paths + Mongoose connection
 *   src/lib         phone/file/media/upload helpers
 *   src/store       in-memory chat store + DB store singleton
 *   src/whatsapp    whatsapp-web.js client + actions
 *   src/controllers request handlers      src/routes  route definitions
 *   src/app.js      express app           src/socket  Socket.IO
 */
require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const socket = require('./src/socket');
const { PORT } = require('./src/config');
const { initDb } = require('./src/config/database');
const dataStore = require('./src/store/dataStore');
const chatStore = require('./src/store/chatStore');
const waClient = require('./src/whatsapp/client');

// Safety net: a logout cleanup race inside whatsapp-web.js can throw EBUSY on
// Windows. Don't let it kill the whole server — log and keep running.
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err && err.message ? err.message : err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err && err.message ? err.message : err));

(async function bootstrap() {
  // 1. Database (optional — app still runs without persistence).
  try {
    const store = await initDb();
    dataStore.setStore(store);
    const count = await chatStore.loadSaved();
    console.log(`[db] Loaded ${count} saved conversation(s).`);
  } catch (e) {
    console.error('[db] init failed — running WITHOUT persistence:', e.message || e);
    dataStore.setStore(null);
  }

  // 2. HTTP + Socket.IO.
  const server = http.createServer(app);
  const io = socket.init(server);
  io.on('connection', (s) => s.emit('wa-status', waClient.currentStatus()));

  // 3. Go live, then start WhatsApp.
  server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
  waClient.initialize();
})();
