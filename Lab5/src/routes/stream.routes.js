const express = require('express');
const router = express.Router();
const streamController = require('../controllers/stream.controller');

router.post('/process', (req, res) => streamController.startStreamProcessing(req, res));
router.get('/backpressure', (req, res) => streamController.testBackpressure(req, res));
router.get('/ws-clients', (req, res) => streamController.getWsClients(req, res));

module.exports = router;