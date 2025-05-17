const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { encryptSecret, decryptSecret } = require('../utils/crypto');
const { Keypair } = require('stellar-sdk');

const prisma = new PrismaClient();

// src/controllers/authController.js
async function register(req, res) {
  try {
    const { email, password } = req.body;
    // ... generación de keypair y encryptSecret ...
    const user = await prisma.user.create({ data: { email, publicKey, secretKeyEncrypted } });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, publicKey });
  } catch (err) {
    console.error('register error:', err);
    // Si es clave duplicada en el campo email
    if (err.code === 'P2002' && err.meta.target.includes('User_email_key')) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }
    return res.status(500).json({ error: 'Registro fallido' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    // Aquí podrías verificar password; asumimos válido
    const secretKey = decryptSecret(user.secretKeyEncrypted);

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '8h'
    });

    return res.json({ token, publicKey: user.publicKey });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { register, login };