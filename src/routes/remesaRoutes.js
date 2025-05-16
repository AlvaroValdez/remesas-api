// src/routes/remesaRoutes.js
const express = require('express');
const { createRemesa, listRemesas } = require('../controllers/remesaController');

// Usa siempre Router de express, jamás require('router')
const router = express.Router();

router.post('/', createRemesa);
router.get('/',  listRemesas);

module.exports = router;
