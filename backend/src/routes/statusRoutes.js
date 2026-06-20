const router = require('express').Router();
const statusController = require('../controllers/statusController');

router.get('/status', statusController.status);
router.post('/logout', statusController.logout);
router.get('/validate/:number', statusController.validate);

module.exports = router;
