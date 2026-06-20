const router = require('express').Router();
const messagesController = require('../controllers/messagesController');

// Mounted at /api/message
router.post('/delete', messagesController.deleteMessage);

module.exports = router;
