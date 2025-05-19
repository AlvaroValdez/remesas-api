// src/routes/remesaRoutes.js
const express = require('express');
const controller = require('../controllers/remesaController');

// Log de debugging: ¿qué exportó tu controlador?
console.log('remesaController exports:', controller);

const { createRemesa, listRemesas } = controller;

const router = express.Router();

// Aquí router.post y router.get **reciben** funciones válidas
router.post('/', createRemesa);
router.get('/:jobId', getRemesaStatus);

module.exports = router;