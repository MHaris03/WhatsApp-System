const router = require('express').Router();
const upload = require('../lib/upload');
const contactsController = require('../controllers/contactsController');

// Mounted at /api/contacts
router.get('/', contactsController.list);
router.post('/import', upload.single('file'), contactsController.importFile);
router.post('/bulk', contactsController.addBulk);
router.post('/clear', contactsController.clear);
router.post('/', contactsController.addOne);
router.delete('/:id', contactsController.remove);

module.exports = router;
