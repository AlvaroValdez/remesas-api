require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { authenticate } = require('./middleware/auth');

// Asegurarnos de arrancar el Worker de remesas al iniciar la app:
require('./queues/remesasQueue');

// Rutas y middlewares
const authRoutes = require('./routes/authRoutes');
const remesaRoutes = require('./routes/remesaRoutes');
const anchorRoutes = require('./routes/anchorRoutes');

const app = express();

// ————— Configuración CORS —————————————————————————————
const corsOptions = {
  origin: [
    'https://miapp.netlify.app',
    'http://localhost:3000',
    'http://localhost:3003'
  ],
  credentials: true
};
app.use(cors(corsOptions));

// ————— Middlewares básicos ————————————————————————————
app.use(express.json());
app.use(cookieParser());

// ————— Health Check ——————————————————————————————————————
app.get('/', (_req, res) => res.send('✅ remesas-api OK'));

// ————— Rutas públicas de autenticación ————————————————————
app.use('/api/auth', authRoutes);

// ————— Rutas protegidas (requieren JWT) —————————————————————
app.use('/api/remesas', authenticate, remesaRoutes);
app.use('/api/anchor', authenticate, anchorRoutes);

// ————— Iniciar servidor ————————————————————————————————————
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Remesas-api corriendo en http://localhost:${PORT}`);
});