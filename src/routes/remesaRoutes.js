const express = require('express');
const router = express.Router();
const { createRemesa } = require('../controllers/remesaController');

// POST /api/remesas
router.post('/', createRemesa);
router.get('/', listRemesas);

module.exports = router;