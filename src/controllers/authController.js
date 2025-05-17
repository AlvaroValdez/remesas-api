// src/controllers/authController.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt     = require('jsonwebtoken');
const { encryptSecret, decryptSecret } = require('../utils/crypto');
const { Keypair } = require('stellar-sdk');

const prisma = new PrismaClient();

async function register(req, res) {
  try {
    const { email, password } = req.body; // no usas password para Stellar, solo para auth

    // 1) Genera un nuevo Keypair Stellar
    const userKp   = Keypair.random();
    const newPublicKey = userKp.publicKey();
    const newSecretKey = userKp.secret();

    // 2) Encripta la secret key
    const secretKeyEncrypted = encryptSecret(newSecretKey);

    // 3) Guarda en la BD
    const user = await prisma.user.create({
      data: {
        email,
        publicKey: newPublicKey,
        secretKeyEncrypted
      }
    });

    // 4) Genera el JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({ token, publicKey: newPublicKey });
  } catch (err) {
    console.error('register error:', err);
    if (err.code === 'P2002' && err.meta?.target?.includes('User_email_key')) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }
    return res.status(500).json({ error: 'Registro fallido' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // (Aquí podrías verificar password si lo guardas)
    // Desencripta la secret key (aunque no la devolvemos al front)
    const secretKey = decryptSecret(user.secretKeyEncrypted);

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({ token, publicKey: user.publicKey });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { register, login };