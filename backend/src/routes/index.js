/**
 * Mounts all API route modules under /api.
 */
const router = require('express').Router();

router.use('/', require('./statusRoutes')); // /status, /logout, /validate/:number
router.use('/contacts', require('./contactsRoutes'));
router.use('/chats', require('./chatsRoutes'));
router.use('/message', require('./messagesRoutes'));
router.use('/', require('./sendRoutes')); // /chat/send, /send

module.exports = router;
