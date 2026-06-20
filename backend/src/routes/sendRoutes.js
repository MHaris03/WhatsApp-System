const router = require('express').Router();
const upload = require('../lib/upload');
const sendController = require('../controllers/sendController');

// Mounted at /api
router.post('/chat/send', upload.single('file'), sendController.sendChat);
router.post('/send', upload.single('file'), sendController.broadcast);

module.exports = router;
