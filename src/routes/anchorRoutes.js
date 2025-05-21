// src/routes/anchorRoutes.js
const express = require('express');
const { initDeposit, handleDepositCallback } = require('../controllers/anchorController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Iniciar depósito (On-Ramp) SEP-24
router.post('/deposit', authenticate, initDeposit);

// Callback del Anchor (sin auth, recibe webhook)
router.post('/callback', express.json(), handleDepositCallback);

module.exports = router;