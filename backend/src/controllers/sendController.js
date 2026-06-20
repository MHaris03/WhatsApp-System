/**
 * Outgoing message endpoints: single chat send and many-number broadcast.
 */
const waClient = require('../whatsapp/client');
const whatsappService = require('../whatsapp/whatsappService');
const { toChatId } = require('../lib/phone');

// POST /api/chat/send  (multipart: chatId|number, message, file)
exports.sendChat = async (req, res) => {
  if (!waClient.isReady()) return res.status(409).json({ ok: false, error: 'WhatsApp not connected.' });

  const message = (req.body.message || '').trim();
  // Prefer the exact chat id (keeps @lid chats working); fall back to a number.
  const rawChatId = (req.body.chatId || '').trim();
  let chatId = rawChatId;
  if (!chatId || (!chatId.endsWith('@c.us') && !chatId.endsWith('@lid'))) {
    chatId = toChatId(req.body.number || rawChatId);
  }

  if (!chatId) return res.status(400).json({ ok: false, error: 'Invalid recipient.' });
  if (!req.file && !message) return res.status(400).json({ ok: false, error: 'Empty message.' });

  try {
    // Only verify phone-number chats (catches typos on NEW chats); @lid chats
    // come from a real incoming message, so they're already valid.
    if (chatId.endsWith('@c.us')) {
      const registered = await whatsappService.isRegistered(chatId);
      if (!registered) return res.status(400).json({ ok: false, error: 'Number not on WhatsApp.' });
    }
    await whatsappService.sendChatMessage({ chatId, message, file: req.file });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
};

// POST /api/send  (multipart: numbers, message, file) — BROADCAST.
exports.broadcast = async (req, res) => {
  if (!waClient.isReady()) {
    return res.status(409).json({ ok: false, error: 'WhatsApp is not connected. Scan the QR first.' });
  }

  const rawNumbers = req.body.numbers || '';
  const message = (req.body.message || '').trim();
  const numbers = rawNumbers.split(/[\s,;]+/).map((n) => n.trim()).filter(Boolean);

  if (numbers.length === 0) return res.status(400).json({ ok: false, error: 'No phone numbers provided.' });
  if (!req.file && !message) return res.status(400).json({ ok: false, error: 'Provide a message and/or a file.' });

  try {
    const { summary, results } = await whatsappService.broadcast({ numbers, message, file: req.file });
    res.json({ ok: true, summary, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
};
