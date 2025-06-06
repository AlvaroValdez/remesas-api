require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { encryptSecret } = require('../utils/crypto');
const { Keypair } = require('stellar-sdk');

const prisma = new PrismaClient(); 
// ↳ PrismaClient leerá DATABASE_URL (que apunta a tu MySQL en Bluehost)

const ACCESS_TOKEN_EXPIRATION = '15m';
const REFRESH_TOKEN_EXPIRATION_DAYS = 7;

function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.SECRET_JWT, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

function generateRefreshToken() {
  return crypto.randomUUID();
}

async function register(req, res) {
  try {
    const { email, password } = req.body;
    // … validaciones …

    const hashedPassword = await bcrypt.hash(password, 10);
    const userKp = Keypair.random();

    // Este prisma.user.create → se enfocará en la base BLUEHOST (porque
    // PrismaClient lee DATABASE_URL que apunta a Bluehost).
    const user = await prisma.user.create({
      data: {
        email,
        passwordHashed: hashedPassword,
        publicKey: userKp.publicKey(),
        secretKeyEncrypted: encryptSecret(userKp.secret())
      }
    });

    // Generamos tokens y los guardamos en la tabla RefreshToken en la misma DB…
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    // Enviamos la cookie con el refreshToken → el navegador la almacenará
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,        // solo HTTPS
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({ accessToken, publicKey: user.publicKey });
  } catch (error) {
    console.error('[REGISTER ERROR]', error);
    // Manejar errores P2002 (email duplicado)…
    return res.status(500).json({ error: 'Error al registrar usuario' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    // 1) Control de fuerza bruta
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

    // 2) Buscar usuario
    const user = await prisma.user.findUnique({ where: { email } });
    const isValid = user && await bcrypt.compare(password, user.passwordHashed);

    // 3) Guardar intento en LoginAttempt (misma DB en Bluehost)
    await prisma.loginAttempt.create({
      data: { email, ip, success: !!isValid }
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // 4) Generar tokens, guardar RefreshToken en la DB (Bluehost)
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

    return res.json({ accessToken, publicKey: user.publicKey });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    return res.status(500).json({ error: 'Error en el login' });
  }
}

async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, publicKey: true, createdAt: true }
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(user);
  } catch (error) {
    console.error('[ME ERROR]', error);
    return res.status(500).json({ error: 'Error al obtener usuario' });
  }
}

async function refresh(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'Refresh token requerido' });

  try {
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(403).json({ error: 'Refresh token inválido o expirado' });
    }
    const newAccessToken = generateAccessToken(stored.userId);
    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('[REFRESH ERROR]', error);
    return res.status(500).json({ error: 'No se pudo renovar token' });
  }
}

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
  return res.json({ message: 'Sesión cerrada correctamente' });
}

module.exports = {
  register,
  login,
  me,
  refresh,
  logout
};