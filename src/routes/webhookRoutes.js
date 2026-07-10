const express = require('express');
const controller = require('../controllers/webhookController');
const router = express.Router();
router.post('/send', controller.send);
router.get('/dead', controller.listDead);
router.get('/:id', controller.getById);
router.post('/:id/replay', controller.replay);
module.exports = router;
