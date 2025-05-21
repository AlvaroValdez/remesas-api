// src/routes/anchorRoutes.js
const express = require('express');
const { initDeposit } = require('../controllers/anchorController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Iniciar depósito (On-Ramp) SEP-24
router.post('/deposit', authenticate, initDeposit);

module.exports = router;