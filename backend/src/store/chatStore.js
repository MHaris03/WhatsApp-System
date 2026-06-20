/**
 * In-memory chat store (chatId -> conversation) mirrored to the database, with
 * real-time Socket.IO notifications. This is the single source of truth the
 * HTTP layer and the WhatsApp client both read/write.
 */
const { getIO } = require('../socket');
const { getStore } = require('./dataStore');
const { toChatId } = require('../lib/phone');

const chats = new Map();
let msgCounter = 0;

function getChat(chatId, name) {
  let chat = chats.get(chatId);
  if (!chat) {
    const isLid = chatId.endsWith('@lid');
    const number = chatId.replace(/@.*/, '');
    chat = {
      id: chatId,
      number,
      isLid,
      name: name || (isLid ? 'WhatsApp user' : number),
      messages: [],
      pinned: false,
      unread: 0,
    };
    chats.set(chatId, chat);
  }
  // Upgrade a placeholder name once we learn the real one.
  if (name && (!chat.name || chat.name === chat.number || chat.name === 'WhatsApp user')) chat.name = name;
  return chat;
}

function recordMessage(chatId, msg, name) {
  const chat = getChat(chatId, name);
  if (!msg.mid) msg.mid = `m${Date.now()}_${++msgCounter}`; // stable id for the UI
  chat.messages.push(msg);
  chat.lastMessage = msg;
  // Track unread for INCOMING messages (survives UI tab switches / refreshes).
  if (msg.direction === 'in') chat.unread = (chat.unread || 0) + 1;
  // Persist.
  const store = getStore();
  if (store) { store.saveMessage(chatId, msg); store.saveChat(chat); }
  // Notify all connected browsers in real time.
  getIO().emit('chat-message', {
    chatId, number: chat.number, name: chat.name, isLid: chat.isLid, unread: chat.unread, message: msg,
  });
}

function chatSummary(chat) {
  return {
    id: chat.id,
    number: chat.number,
    isLid: chat.isLid,
    name: chat.name,
    pinned: chat.pinned,
    last: chat.lastMessage || null,
    unread: chat.unread || 0,
  };
}

// List all conversations (pinned first, then most recent).
function listChats() {
  return Array.from(chats.values())
    .map(chatSummary)
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return (b.last?.timestamp || 0) - (a.last?.timestamp || 0);
    });
}

// Full conversation (id may be a chatId or a bare number).
function getConversation(idParam) {
  return chats.get(idParam) || chats.get(toChatId(idParam)) || null;
}

function deleteChat(id) {
  chats.delete(id);
  const store = getStore();
  if (store) store.removeChat(id);
  getIO().emit('chat-deleted', { chatId: id });
}

function markRead(id) {
  const chat = chats.get(id);
  if (chat) chat.unread = 0;
  const store = getStore();
  if (store) store.setUnread(id, 0);
}

function clearMessages(id) {
  const chat = chats.get(id);
  if (chat) { chat.messages = []; chat.lastMessage = null; chat.unread = 0; }
  const store = getStore();
  if (store) store.clearMessages(id);
  getIO().emit('chat-cleared', { chatId: id });
}

function togglePin(id) {
  const chat = chats.get(id);
  if (chat) chat.pinned = !chat.pinned;
  const store = getStore();
  if (store && chat) store.setPinned(chat.id, chat.pinned);
  return chat ? chat.pinned : false;
}

// Remove a single message from the in-memory thread + database.
function removeMessageLocal({ chatId, mid, wid }) {
  const chat = chats.get(chatId);
  if (chat) {
    chat.messages = chat.messages.filter((m) => !((mid && m.mid === mid) || (wid && m.wid === wid)));
    chat.lastMessage = chat.messages[chat.messages.length - 1] || null;
  }
  const store = getStore();
  if (store) { store.removeMessage({ mid, wid }); if (chat) store.saveChat(chat); }
}

// Forget every conversation (used on logout).
function clearAll() {
  chats.clear();
  const store = getStore();
  if (store) store.wipeAll();
}

// Load saved conversations from the database into memory (startup). Returns count.
async function loadSaved() {
  const store = getStore();
  if (!store) return 0;
  const saved = await store.loadAll();
  for (const c of saved) chats.set(c.id, c);
  return saved.length;
}

module.exports = {
  getChat,
  recordMessage,
  chatSummary,
  listChats,
  getConversation,
  deleteChat,
  markRead,
  clearMessages,
  togglePin,
  removeMessageLocal,
  clearAll,
  loadSaved,
};
