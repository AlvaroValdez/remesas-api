const express = require('express');
const {
  register,
  login,
  logout,
  me,
  refresh
} = require('../controllers/authController');

const { authenticate } = require('../middleware/auth'); 
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticate, me); 
router.post('/logout', logout);

module.exports = router;

