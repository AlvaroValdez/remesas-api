// src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes   = require('./routes/authRoutes');
const { authenticate } = require('./middleware/auth');
const remesaRoutes = require('./routes/remesaRoutes');
const anchorRoutes = require('./routes/anchorRoutes');

const app = express();

const corsOptions = {
  origin: ['https://miapp.netlify.app', 'http://localhost:3000'], // o localhost para pruebas
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/', (_req, res) => res.send('✅ remesas-api OK'));

// Public auth routes
app.use('/api/auth', authRoutes);

// Protected remesas routes (JWT required)
app.use('/api/remesas', authenticate, remesaRoutes);

// Protected Anchor SEP-24 routes (JWT required)
app.use('/api/anchor', authenticate, anchorRoutes);

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Remesas-api corriendo en http://localhost:${PORT}`);
});