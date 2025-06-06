// src/controllers/remesaController.js
const remesasQueue = require('../queues/remesasQueue');
const { PrismaClient } = require('@prisma/client');
const IORedis = require('ioredis');

const prisma = new PrismaClient();

async function createRemesa(req, res) {
  try {
    // Asegurarnos de convertir monto a número
    const monto = Number(req.body.monto);
    if (isNaN(monto) || monto <= 0) {
      return res.status(400).json({ error: 'El monto debe ser un número mayor que 0' });
    }

    const cuenta_destino = req.body.cuenta_destino;
    if (!cuenta_destino) {
      return res.status(400).json({ error: 'Falta cuenta_destino' });
    }

    const memo = req.body.memo || '';

    // Encolar el job
    const job = await remesasQueue.add('nueva-remesa', {
      userId: req.userId,
      monto,
      cuenta_destino,
      memo
    });
    console.log('[Controller] Job encolado con ID:', job.id);
    return res.status(200).json({ jobId: job.id });
    
  } catch (err) {
    console.error('[Controller] Error en createRemesa:', err);
    return res.status(500).json({ error: 'Error al encolar la remesa' });
  }
}
