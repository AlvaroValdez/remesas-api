// src/controllers/remesaController.js
require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// POST /api/remesas
async function createRemesa(req, res) {
  const payloadFront = req.body;
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { publicKey: true }
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const payloadN8n = {
      ...payloadFront,
      remitente: user.publicKey,
    };

    console.log('▶️ Enviando a n8n:', n8nUrl, payloadN8n);
    const response = await axios.post(n8nUrl, payloadN8n);
    console.log('✅ n8n respondió:', response.status, response.data);
    return res.status(response.status).json(response.data);
  } catch (err) {
    console.error('❌ createRemesa error:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });
    const msg = err.response?.data?.error || err.message;
    return res.status(500).json({ error: msg });
  }
}

// GET /api/remesas
async function listRemesas(req, res) {
  try {
    const remesas = await prisma.transaccion.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    console.log('📄 listRemesas devuelve', remesas.length, 'elementos');
    return res.json(remesas);
  } catch (err) {
    console.error('❌ listRemesas error:', err);
    return res.status(500).json({ error: 'No se pudo obtener historial' });
  }
}

// IMPORTANTE: exporta **ambas** funciones
module.exports = {
  createRemesa,
  listRemesas,
};