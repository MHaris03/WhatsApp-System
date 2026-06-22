/**
 * whatsapp-web.js client: lifecycle, connection state, QR, incoming messages,
 * and @lid → phone-number thread resolution. Emits `wa-status` over Socket.IO.
 */
const path = require('path');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { AUTH_DIR } = require('../config');
const { getIO } = require('../socket');
const { saveMedia } = require('../lib/media');
const chatStore = require('../store/chatStore');

let waReady = false;
let lastQrDataUrl = null;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
  puppeteer: {
    headless: true,
    // In Docker we use the system Chromium (PUPPETEER_EXECUTABLE_PATH); locally
    // this is unset, so Puppeteer falls back to its own bundled Chromium.
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  },
});

// ---- State accessors ----
const isReady = () => waReady;
const getQr = () => lastQrDataUrl;
function currentStatus() {
  if (waReady) return { status: 'ready' };
  if (lastQrDataUrl) return { status: 'qr', qr: lastQrDataUrl };
  return { status: 'loading' };
}

// ---- Lifecycle events ----
client.on('qr', async (qr) => {
  lastQrDataUrl = await qrcode.toDataURL(qr);
  waReady = false;
  getIO().emit('wa-status', { status: 'qr', qr: lastQrDataUrl });
  console.log('[WA] QR generated — scan it from the frontend.');
});

client.on('authenticated', () => {
  console.log('[WA] Authenticated.');
  getIO().emit('wa-status', { status: 'authenticated' });
});

client.on('ready', () => {
  waReady = true;
  lastQrDataUrl = null;
  console.log('[WA] Client is ready.');
  getIO().emit('wa-status', { status: 'ready' });
});

client.on('auth_failure', (msg) => {
  waReady = false;
  console.error('[WA] Auth failure:', msg);
  getIO().emit('wa-status', { status: 'auth_failure', message: String(msg) });
});

// Single guarded restart: fully close the old browser, wait for Windows to
// release the session files, then re-initialize so a NEW QR is generated.
let busy = false;
function freshStart(delay = 3500) {
  if (busy) return;
  busy = true;
  client.destroy().catch(() => {}).finally(() => {
    setTimeout(() => {
      console.log('[WA] Re-initializing for a fresh QR…');
      client.initialize()
        .catch((e) => console.error('[WA] initialize failed:', e.message || e))
        .finally(() => { busy = false; });
    }, delay);
  });
}

client.on('disconnected', (reason) => {
  waReady = false;
  lastQrDataUrl = null;
  console.warn('[WA] Disconnected:', reason);
  getIO().emit('wa-status', { status: 'loading' });
  freshStart(4000);
});

// ---- @lid → phone-number resolution ----
const lidPnCache = new Map();

async function lidToPn(lidId) {
  if (!lidId || !lidId.endsWith('@lid')) return null;
  if (lidPnCache.has(lidId)) return lidPnCache.get(lidId);
  try {
    const res = await client.getContactLidAndPhone([lidId]);
    const pn = res && res[0] && res[0].pn ? res[0].pn : null;
    if (pn) lidPnCache.set(lidId, pn);
    return pn;
  } catch (_) {
    return null;
  }
}

/**
 * Resolve any incoming message to a CANONICAL phone-number thread (@c.us) so
 * an @lid reply lands in the same thread you started by typing the number.
 */
async function resolveThread(msg) {
  let chatId = null;
  let number = null;
  let name = null;

  try {
    const chat = await msg.getChat();
    if (chat && chat.id && chat.id._serialized) chatId = chat.id._serialized;
    if (chat && chat.name) name = chat.name;
  } catch (_) {}

  try {
    const contact = await msg.getContact();
    if (contact) {
      if (contact.number) number = String(contact.number).replace(/[^\d]/g, '');
      if (!name) name = contact.pushname || contact.name || contact.shortName || contact.number;
    }
  } catch (_) {}

  if (!chatId) chatId = msg.from;

  if (chatId.endsWith('@lid')) {
    const pn = await lidToPn(chatId);
    if (pn) chatId = pn; // now "<number>@c.us"
  }

  if (chatId.endsWith('@c.us')) number = chatId.replace('@c.us', '');
  if (!number) number = chatId.replace(/@.*/, '');

  return { chatId, number, name: name || number };
}

// ---- Incoming messages from other people ----
client.on('message', async (msg) => {
  try {
    if (msg.isStatus) return; // ignore status broadcasts
    if (msg.from.endsWith('@g.us')) return; // skip group chats (direct only for now)

    const { chatId, name } = await resolveThread(msg);

    let media = null;
    if (msg.hasMedia) {
      const downloaded = await msg.downloadMedia();
      if (downloaded && downloaded.data) {
        media = saveMedia(downloaded.data, downloaded.mimetype, downloaded.filename);
      }
    }

    chatStore.recordMessage(
      chatId,
      {
        direction: 'in',
        body: msg.body || '',
        media,
        kind: msg.type, // image | video | audio | ptt | sticker | document | gif ...
        timestamp: (msg.timestamp || Math.floor(Date.now() / 1000)) * 1000,
        wid: msg.id ? msg.id._serialized : null,
      },
      name
    );
  } catch (e) {
    console.error('[WA] message handler error:', e);
  }
});

// ---- Public lifecycle helpers ----
function initialize() {
  return client.initialize().catch((e) => console.error('[WA] Init failed:', e));
}

// Log out of WhatsApp, wipe conversations, and re-init for a fresh QR.
async function logoutAndReset() {
  waReady = false;
  lastQrDataUrl = null;
  chatStore.clearAll();
  const io = getIO();
  io.emit('wa-status', { status: 'loading' });
  io.emit('session-reset');
  try {
    await client.logout();
  } catch (e) {
    console.error('[WA] logout error (ignored):', e.message || e);
  }
  freshStart(3500);
}

module.exports = { client, isReady, getQr, currentStatus, initialize, logoutAndReset };
