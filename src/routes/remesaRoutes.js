// src/routes/remesaRoutes.js
const express = require('express');
const { createRemesa, listRemesas } = require('../controllers/remesaController');

const router = express.Router();

// Ahora **listRemesas** existe y es función
router.post('/', createRemesa);
router.get('/',  listRemesas);

module.exports = router;