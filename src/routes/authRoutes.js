const express = require('express');
const { register, login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth'); // 👈 Importación necesaria

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me); // 👈 Ruta protegida

module.exports = router;