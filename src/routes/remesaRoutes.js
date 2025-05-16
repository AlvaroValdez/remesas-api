const express = require('express');
const { createRemesa, listRemesas } = require('../controllers/remesaController');

const router = express.Router();

router.post('/', createRemesa);
router.get('/',  listRemesas);

module.exports = router;