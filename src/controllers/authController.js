const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { encryptSecret, decryptSecret } = require('../utils/crypto');


const prisma = new PrismaClient();

async function register(req, res) {
  try {
    const { email, secretKey } = req.body;
    // 1. Genera keypair desde esa secretKey
    const { Keypair } = require('stellar-sdk');
    const kp = Keypair.fromSecret(secretKey);

    // 2. Encripta la secret
    const secretKeyEncrypted = encryptSecret(secretKey);

    // 3. Guarda en la BD
    const user = await prisma.user.create({
      data: {
        email,
        publicKey: kp.publicKey(),
        secretKeyEncrypted
      }
    });

    // 4. Crea un token JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '8h'
    });

    return res.json({ token, publicKey: user.publicKey });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Registro fallido' });
  }
}

async function login(req, res) {
  try {
    const { email, secretKey } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Desencripta y compara
    const { decryptSecret } = require('../utils/crypto');
    const savedSecret = decryptSecret(user.secretKeyEncrypted);
    if (savedSecret !== secretKey) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '8h'
    });
    return res.json({ token, publicKey: user.publicKey });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { register, login };