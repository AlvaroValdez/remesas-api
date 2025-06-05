// remesaRoutes.js
const express = require('express');
const { createRemesa, listRemesas, getRemesaStatus } = require('../controllers/remesaController');
const router = express.Router();

router.post('/', createRemesa);
router.get('/', listRemesas);
router.get('/:jobId', getRemesaStatus);

module.exports = router;