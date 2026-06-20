/**
 * Message-level endpoints: delete a message (locally, in the DB, and on WhatsApp).
 */
const { getIO } = require('../socket');
const chatStore = require('../store/chatStore');
const whatsappService = require('../whatsapp/whatsappService');

// POST /api/message/delete — body: { chatId, wid, mid, everyone }
exports.deleteMessage = async (req, res) => {
  const { chatId, wid, mid, everyone } = req.body || {};
  chatStore.removeMessageLocal({ chatId, mid, wid });
  const waDeleted = await whatsappService.deleteWaMessage(chatId, wid, everyone);
  getIO().emit('message-deleted', { chatId, wid, mid });
  res.json({ ok: true, waDeleted });
};
