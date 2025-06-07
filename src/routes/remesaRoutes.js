// remesaRoutes.js
const express = require('express');
// Nos aseguramos de importar exactamente estos tres nombres:
const {
  createRemesa,
  listRemesas,
  getRemesaStatus 
} = require('../controllers/remesaController');

const router = express.Router();

// POST  /api/remesas       -> createRemesa
router.post('/', createRemesa);

// GET   /api/remesas       -> listRemesas
router.get('/', listRemesas);

// GET   /api/remesas/:jobId -> getRemesaStatus
router.get('/:jobId', getRemesaStatus);

module.exports = router;
