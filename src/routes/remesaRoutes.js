// src/routes/remesaRoutes.js
const express = require('express');
const {
  createRemesa,
  listRemesas,
  getRemesaStatus
} = require('../controllers/remesaController');

const router = express.Router();

// Encolar una nueva remesa
router.post('/', createRemesa);

// Listar historial de remesas del usuario
router.get('/', listRemesas);

// Consultar estado de un job por ID
router.get('/:jobId', getRemesaStatus);

module.exports = router;