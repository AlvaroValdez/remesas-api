// index.js (en la raíz del proyecto remesas-api)
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

// Requiere desde la carpeta src:
const authRoutes   = require('./src/routes/authRoutes');
const auth         = require('./src/middleware/auth');           // si lo pusiste en src/middleware
const remesaRoutes = require('./src/routes/remesaRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas públicas de auth
app.use('/api/auth', authRoutes);

// Rutas protegidas de remesas
app.use('/api/remesas', auth, remesaRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 remesas-api corriendo en http://localhost:${PORT}`);
});