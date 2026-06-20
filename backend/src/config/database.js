/**
 * MongoDB persistence using Mongoose (MongoDB Atlas).
 *
 * EVERYTHING is stored in a SINGLE collection ("WhatsApp-Chat" by default) in
 * the WhatsApp-System database. Each document carries a `type` field so the
 * three kinds of data coexist in one place:
 *    type: 'chat'     → one conversation        (key: "chat:<chatId>")
 *    type: 'message'  → one message in a chat   (key: "msg:<mid>")
 *    type: 'contact'  → one saved contact       (key: "contact:<id>")
 * `key` is unique, so upserts never create duplicates.
 *
 * Config (backend/.env):
 *    MONGODB_URI         required — Atlas connection string
 *    MONGODB_DB          database name (default: WhatsApp-System)
 *    MONGODB_COLLECTION  collection name (default: WhatsApp-Chat)
 */
const mongoose = require('mongoose');

const COLLECTION = process.env.MONGODB_COLLECTION || 'WhatsApp-Chat';

// ---- One schema for everything, pinned to the single collection -------------
const docSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // "chat:..|msg:..|contact:.."
    type: { type: String, index: true }, // 'chat' | 'message' | 'contact'

    // shared / chat + contact
    id: String, // chatId (chat) or contact id (contact)
    number: { type: String, default: '' },
    name: { type: String, default: '' },

    // chat-only
    isLid: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    unread: { type: Number, default: 0 },
    lastTs: { type: Number, default: 0 },

    // message-only
    mid: String,
    chatId: String,
    direction: String, // 'in' | 'out'
    body: { type: String, default: '' },
    media: { type: mongoose.Schema.Types.Mixed, default: null },
    kind: { type: String, default: null },
    wid: { type: String, default: null },
    timestamp: { type: Number, default: 0 },

    // contact-only
    country: { type: String, default: '' },
    createdAt: { type: Number, default: 0 },
  },
  { collection: COLLECTION, versionKey: false }
);
docSchema.index({ type: 1, chatId: 1, timestamp: 1 }); // fast message lookups

const Doc = mongoose.model('WhatsAppDoc', docSchema);

// Document-key builders.
const chatKey = (id) => `chat:${id}`;
const msgKey = (mid) => `msg:${mid}`;
const contactKey = (id) => `contact:${id}`;

// Wrap fire-and-forget writes so a DB hiccup logs instead of crashing.
async function guard(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[db] ${label} failed:`, e.message || e);
    return null;
  }
}

async function initDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Put your MongoDB Atlas connection string in ' +
        'backend/.env (see backend/.env.example).'
    );
  }
  const dbName = process.env.MONGODB_DB || 'WhatsApp-System';
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 15000 });
  console.log(`[db] Connected to MongoDB Atlas (db: ${dbName}, collection: ${COLLECTION}).`);
  return api;
}

// ---- Contacts (company directory for the Broadcast picker) ----
async function listContacts() {
  const rows = await Doc.find({ type: 'contact' }).sort({ createdAt: -1 }).lean();
  return rows.map((r) => ({ id: r.id, name: r.name, number: r.number, country: r.country }));
}

async function addContact(c) {
  return guard('addContact', () =>
    Doc.updateOne(
      { key: contactKey(c.id) },
      {
        $set: {
          key: contactKey(c.id),
          type: 'contact',
          id: c.id,
          name: c.name || '',
          number: c.number || '',
          country: c.country || '',
          createdAt: c.createdAt || 0,
        },
      },
      { upsert: true }
    )
  );
}

async function removeContact(id) {
  return guard('removeContact', () => Doc.deleteOne({ key: contactKey(id) }));
}

async function clearContacts() {
  return guard('clearContacts', () => Doc.deleteMany({ type: 'contact' }));
}

// Load every conversation (with its messages) back into memory on startup.
async function loadAll() {
  const chatRows = await Doc.find({ type: 'chat' }).lean();
  const out = [];
  for (const r of chatRows) {
    const msgRows = await Doc.find({ type: 'message', chatId: r.id }).sort({ timestamp: 1 }).lean();
    const messages = msgRows.map((m) => ({
      mid: m.mid,
      direction: m.direction,
      body: m.body || '',
      media: m.media || null,
      kind: m.kind || undefined,
      wid: m.wid || null,
      timestamp: m.timestamp || 0,
    }));
    out.push({
      id: r.id,
      number: r.number,
      isLid: !!r.isLid,
      name: r.name,
      pinned: !!r.pinned,
      unread: r.unread || 0,
      messages,
      lastMessage: messages[messages.length - 1] || null,
    });
  }
  return out;
}

async function saveChat(c) {
  return guard('saveChat', () =>
    Doc.updateOne(
      { key: chatKey(c.id) },
      {
        $set: {
          key: chatKey(c.id),
          type: 'chat',
          id: c.id,
          number: c.number || '',
          isLid: !!c.isLid,
          name: c.name || '',
          pinned: !!c.pinned,
          unread: c.unread || 0,
          lastTs: (c.lastMessage && c.lastMessage.timestamp) || 0,
        },
      },
      { upsert: true }
    )
  );
}

async function saveMessage(chatId, m) {
  return guard('saveMessage', () =>
    Doc.updateOne(
      { key: msgKey(m.mid) },
      {
        $set: {
          key: msgKey(m.mid),
          type: 'message',
          mid: m.mid,
          chatId,
          direction: m.direction,
          body: m.body || '',
          media: m.media || null,
          kind: m.kind || null,
          wid: m.wid || null,
          timestamp: m.timestamp || 0,
        },
      },
      { upsert: true }
    )
  );
}

async function setUnread(id, n) {
  return guard('setUnread', () => Doc.updateOne({ key: chatKey(id) }, { $set: { unread: n } }));
}

async function setPinned(id, pinned) {
  return guard('setPinned', () => Doc.updateOne({ key: chatKey(id) }, { $set: { pinned: !!pinned } }));
}

async function removeChat(id) {
  return guard('removeChat', async () => {
    await Doc.deleteMany({ type: 'message', chatId: id });
    await Doc.deleteOne({ key: chatKey(id) });
  });
}

async function clearMessages(id) {
  return guard('clearMessages', async () => {
    await Doc.deleteMany({ type: 'message', chatId: id });
    await Doc.updateOne({ key: chatKey(id) }, { $set: { unread: 0, lastTs: 0 } });
  });
}

async function removeMessage({ mid, wid }) {
  return guard('removeMessage', async () => {
    if (mid) await Doc.deleteOne({ key: msgKey(mid) });
    if (wid) await Doc.deleteOne({ type: 'message', wid });
  });
}

async function wipeAll() {
  return guard('wipeAll', () => Doc.deleteMany({ type: { $in: ['chat', 'message'] } }));
}

const api = {
  loadAll, saveChat, saveMessage, setUnread, setPinned,
  removeChat, clearMessages, removeMessage, wipeAll,
  listContacts, addContact, removeContact, clearContacts,
};

module.exports = { initDb };
