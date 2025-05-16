require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes   = require('./routes/authRoutes');
const auth         = require('./middleware/auth');
const remesaRoutes = require('./routes/remesaRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas públicas de auth
app.use('/api/auth', authRoutes);

// Rutas protegidas de remesas (requieren JWT)
app.use('/api/remesas', auth, remesaRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 remesas-api corriendo en http://localhost:${PORT}`);
});