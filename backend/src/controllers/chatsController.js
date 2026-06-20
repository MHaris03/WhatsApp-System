/**
 * Conversation endpoints: list, history, delete, mark-read, clear, pin, block.
 */
const chatStore = require('../store/chatStore');
const whatsappService = require('../whatsapp/whatsappService');

// GET /api/chats
exports.list = (req, res) => {
  res.json({ ok: true, chats: chatStore.listChats() });
};

// GET /api/chats/:id — full message history.
exports.getOne = (req, res) => {
  const chat = chatStore.getConversation(req.params.id);
  if (!chat) return res.json({ ok: true, chat: null, messages: [] });
  res.json({ ok: true, chat: chatStore.chatSummary(chat), messages: chat.messages });
};

// DELETE /api/chats/:id
exports.remove = (req, res) => {
  chatStore.deleteChat(req.params.id);
  res.json({ ok: true });
};

// POST /api/chats/:id/read
exports.markRead = (req, res) => {
  chatStore.markRead(req.params.id);
  res.json({ ok: true });
};

// POST /api/chats/:id/clear
exports.clearMessages = (req, res) => {
  chatStore.clearMessages(req.params.id);
  res.json({ ok: true });
};

// POST /api/chats/:id/pin
exports.pin = (req, res) => {
  const pinned = chatStore.togglePin(req.params.id);
  res.json({ ok: true, pinned });
};

// POST /api/chats/:id/block — block the contact on WhatsApp.
exports.block = async (req, res) => {
  try {
    await whatsappService.blockContact(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
};
