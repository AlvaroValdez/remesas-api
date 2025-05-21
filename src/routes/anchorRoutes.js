// src/routes/anchorRoutes.js
const express = require('express');
const { initDeposit } = require('../controllers/anchorController');
const router = express.Router();

// Requiere auth middleware antes
const { authenticate } = require('../middleware/auth');

router.post('/deposit', authenticate, initDeposit);

module.exports = router;