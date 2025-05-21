// src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes   = require('./routes/authRoutes');
const { authenticate } = require('./middleware/auth');
const remesaRoutes = require('./routes/remesaRoutes');
const anchorRoutes = require('./routes/anchorRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (_req, res) => res.send('✅ remesas-api OK'));

// Public auth routes
app.use('/api/auth', authRoutes);

// Protected remesas routes (JWT required)
app.use('/api/remesas', authenticate, remesaRoutes);

// Protected Anchor SEP-24 routes (JWT required)
//app.use('/api/anchor', authenticate, anchorRoutes);

app.use('/api/anchor', anchorRoutes);

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 remesas-api corriendo en http://localhost:${PORT}`);
});