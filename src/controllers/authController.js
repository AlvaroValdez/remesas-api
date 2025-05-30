require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { encryptSecret } = require('../utils/crypto');
const { Keypair } = require('stellar-sdk');

const prisma = new PrismaClient();

const ACCESS_TOKEN_EXPIRATION = '15m';
const REFRESH_TOKEN_EXPIRATION_DAYS = 7;

function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

function generateRefreshToken() {
  return crypto.randomUUID();
}

// Registro
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

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken, publicKey: user.publicKey });

  } catch (err) {
    console.error('[REGISTER ERROR]', err);
    res.status(500).json({ error: 'Error en el registro' });
  }
}

// Login
async function login(req, res) {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    // Control de intentos fallidos
    const maxAttempts = 5;
    const windowMinutes = 15;
    const recentFails = await prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: {
          gte: new Date(Date.now() - windowMinutes * 60 * 1000)
        }
      }
    });

    if (recentFails >= maxAttempts) {
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Intenta más tarde.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const isValid = user && await bcrypt.compare(password, user.passwordHashed);

    await prisma.loginAttempt.create({ data: { email, ip, success: !!isValid } });

    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken, publicKey: user.publicKey });

  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ error: 'Error en el login' });
  }
}

// /me
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

// /refresh
async function refresh(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'Refresh token requerido' });
  }

  try {
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(403).json({ error: 'Refresh token inválido o expirado' });
    }

    const newAccessToken = generateAccessToken(stored.userId);
    res.json({ accessToken: newAccessToken });

  } catch (err) {
    console.error('[REFRESH ERROR]', err);
    res.status(500).json({ error: 'No se pudo renovar token' });
  }
}

// /logout
async function logout(req, res) {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      await prisma.refreshToken.delete({ where: { token } });
    } catch (err) {
      console.warn('[LOGOUT WARNING] Token no encontrado o ya eliminado');
    }
  }

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  });

  res.status(200).json({ message: 'Sesión cerrada correctamente' });
}

module.exports = {
  register,
  login,
  logout,
  me,
  refresh
};