// src/controllers/remesaController.js
require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// POST /api/remesas
async function createRemesa(req, res) {
  // … tu lógica actual …
}

// GET /api/remesas
async function listRemesas(req, res) {
  try {
    const userId = req.userId; // viene del middleware
    const remesas = await prisma.transaccion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(remesas);
  } catch (err) {
    console.error('Error listRemesas:', err);
    return res.status(500).json({ error: 'No se pudo obtener historial' });
  }
}

// **IMPORTANTE**: exporta ambas funciones
module.exports = {
  createRemesa,
  listRemesas,
};