/**
 * WhatsApp actions used by the HTTP layer: send a chat message, broadcast to
 * many numbers, block a contact, and delete a message. Each records into the
 * chat store and emits real-time updates where appropriate.
 */
const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const { client } = require('./client');
const { getIO } = require('../socket');
const { saveMedia } = require('../lib/media');
const { toChatId } = require('../lib/phone');
const chatStore = require('../store/chatStore');

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const isRegistered = (chatId) => client.isRegisteredUser(chatId);

// Send one message (optionally with a file) and record it as outgoing.
async function sendChatMessage({ chatId, message, file }) {
  let mediaMeta = null;
  let sentMsg;
  if (file) {
    const wmedia = MessageMedia.fromFilePath(file.path);
    sentMsg = await client.sendMessage(chatId, wmedia, { caption: message || undefined });
    mediaMeta = saveMedia(wmedia.data, wmedia.mimetype, file.originalname); // keep previewable copy
    fs.unlink(file.path, () => {});
  } else {
    sentMsg = await client.sendMessage(chatId, message);
  }

  chatStore.recordMessage(chatId, {
    direction: 'out',
    body: message,
    media: mediaMeta,
    timestamp: Date.now(),
    wid: sentMsg && sentMsg.id ? sentMsg.id._serialized : null,
  });
}

// Broadcast to many numbers sequentially (with a gap), emitting progress.
async function broadcast({ numbers, message, file }) {
  let media = null;
  let mediaMeta = null;
  if (file) {
    media = MessageMedia.fromFilePath(file.path);
    mediaMeta = saveMedia(media.data, media.mimetype, file.originalname);
  }

  const io = getIO();
  const results = [];

  for (let i = 0; i < numbers.length; i++) {
    const num = numbers[i];
    const chatId = toChatId(num);
    if (!chatId) {
      results.push({ number: num, status: 'invalid', error: 'Not a valid number' });
      io.emit('send-progress', { index: i, total: numbers.length, number: num, status: 'invalid' });
      continue;
    }

    try {
      const registered = await client.isRegisteredUser(chatId);
      if (!registered) {
        results.push({ number: num, status: 'not_registered', error: 'Number not on WhatsApp' });
        io.emit('send-progress', { index: i, total: numbers.length, number: num, status: 'not_registered' });
        continue;
      }

      let sentMsg;
      if (media) sentMsg = await client.sendMessage(chatId, media, { caption: message || undefined });
      else sentMsg = await client.sendMessage(chatId, message);

      chatStore.recordMessage(chatId, {
        direction: 'out', body: message, media: mediaMeta, timestamp: Date.now(),
        wid: sentMsg && sentMsg.id ? sentMsg.id._serialized : null,
      });

      results.push({ number: num, status: 'sent' });
      io.emit('send-progress', { index: i, total: numbers.length, number: num, status: 'sent' });
    } catch (err) {
      results.push({ number: num, status: 'failed', error: String(err && err.message ? err.message : err) });
      io.emit('send-progress', { index: i, total: numbers.length, number: num, status: 'failed' });
    }

    await sleep(1500);
  }

  if (file) fs.unlink(file.path, () => {});

  const summary = {
    total: numbers.length,
    sent: results.filter((r) => r.status === 'sent').length,
    failed: results.filter((r) => r.status !== 'sent').length,
  };
  return { summary, results };
}

async function blockContact(id) {
  const contact = await client.getContactById(id);
  await contact.block();
}

// Find the underlying WhatsApp Message object so we can delete it.
async function findWaMessage(chatId, wid) {
  if (!wid) return null;
  try {
    const chat = await client.getChatById(chatId);
    const msgs = await chat.fetchMessages({ limit: 100 });
    return msgs.find((m) => m.id && m.id._serialized === wid) || null;
  } catch (_) {
    return null;
  }
}

// Delete a message on WhatsApp itself (for me, or for everyone). Returns true if done.
async function deleteWaMessage(chatId, wid, everyone) {
  const waMsg = await findWaMessage(chatId, wid);
  if (!waMsg) return false;
  try {
    await waMsg.delete(!!everyone);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { isRegistered, sendChatMessage, broadcast, blockContact, deleteWaMessage };
