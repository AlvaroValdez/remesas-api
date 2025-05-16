// src/controllers/remesaController.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createRemesa(req, res) {
  const payloadFront = req.body;
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  try {
    // 1. Recupera el userId y la publicKey del usuario logueado
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { publicKey: true }
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 2. Construye el payload que va a n8n (ya no usamos remitente enviado por el front)
    const payloadN8n = {
      ...payloadFront,
      remitente: user.publicKey,
    };

    console.log('▶️ Enviando a n8n:', n8nUrl, payloadN8n);
    const response = await axios.post(n8nUrl, payloadN8n);
    console.log('✅ n8n respondió:', response.status);
    return res.status(response.status).json(response.data);
  } catch (err) {
    console.error('❌ Error en remesaController:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });
    const msg = err.response?.data?.error || err.message;
    return res.status(500).json({ error: msg });
  }
}

module.exports = { createRemesa };