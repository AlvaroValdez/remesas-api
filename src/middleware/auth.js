// src/middleware/auth.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware para autenticación vía JWT
  async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Recupera usuario y su publicKey
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    req.userId = user.id;
    req.userPublicKey = user.publicKey;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { authenticate };