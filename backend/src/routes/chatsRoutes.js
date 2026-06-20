const router = require('express').Router();
const chatsController = require('../controllers/chatsController');

// Mounted at /api/chats
router.get('/', chatsController.list);
router.get('/:id', chatsController.getOne);
router.delete('/:id', chatsController.remove);
router.post('/:id/read', chatsController.markRead);
router.post('/:id/clear', chatsController.clearMessages);
router.post('/:id/pin', chatsController.pin);
router.post('/:id/block', chatsController.block);

module.exports = router;
