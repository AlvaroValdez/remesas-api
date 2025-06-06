require('dotenv').config();
const jwt = require('jsonwebtoken');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = authHeader.split(' ')[1]; // toma solo la segunda parte
  try {
    const payload = jwt.verify(token, process.env.SECRET_JWT);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = { authenticate };