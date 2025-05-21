const jwt = require('jsonwebtoken');
const token = req.headers.authorization?.split(' ')[1];
const payload = jwt.verify(token, process.env.JWT_SECRET);
const user = await prisma.user.findUnique({ where: { id: payload.userId } });

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado: falta token' });
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}


if (!user) throw new Error('Usuario no encontrado');
req.userId = user.id;
req.userPublicKey = user.publicKey;  // <-- aquí
next();

module.exports = authenticate;