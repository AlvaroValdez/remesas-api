// src/middleware/auth.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware para autenticación vía JWT
  async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn('[AUTH FAIL] Token ausente');
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    console.warn('[AUTH FAIL] Token inválido:', err.message);
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { authenticate };