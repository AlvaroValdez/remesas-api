const express = require('express');
const { register, login } = require('../controllers/authController');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);

module.exports = router;