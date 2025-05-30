const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ACCESS_TOKEN_EXPIRATION = '15m';
const REFRESH_TOKEN_EXPIRATION_DAYS = 7;

function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

function generateRefreshToken() {
  return crypto.randomUUID();
}

//Login
async function login(req, res) {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHashed))) {
      await prisma.loginAttempt.create({ data: { email, ip, success: false } });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await prisma.loginAttempt.create({ data: { email, ip, success: true } });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();

    // Guardar en la base de datos
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    // Enviar refreshToken como cookie httpOnly
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
  //Logout
  async function logout(req, res) {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(200).json({ message: 'Sesión cerrada' }); // nada que borrar
    }

    try {
      await prisma.refreshToken.delete({ where: { token } });
    } catch (err) {
      console.warn('[LOGOUT WARNING] Token no encontrado o ya eliminado');
      // continúa para limpiar cookie
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    });

    res.status(200).json({ message: 'Sesión cerrada correctamente' });
  }
}