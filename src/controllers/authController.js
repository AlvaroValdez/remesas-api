require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { encryptSecret } = require('../utils/crypto');
const { Keypair } = require('stellar-sdk');

const prisma = new PrismaClient();

// Registro de usuario
async function register(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan email o contraseña' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userKp = Keypair.random();

    const user = await prisma.user.create({
      data: {
        email,
        passwordHashed: hashedPassword,
        publicKey: userKp.publicKey(),
        secretKeyEncrypted: encryptSecret(userKp.secret())
      }
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, publicKey: user.publicKey });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error en el registro' });
  }
}

// Login de usuario
async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHashed);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, publicKey: user.publicKey });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error en el login' });
  }
}

//Identificar al usuario autenticado a partir de token JWT
async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        publicKey: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (err) {
    console.error('Error en /me:', err);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
}

module.exports = { register, login, me };