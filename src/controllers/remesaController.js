// src/controllers/remesaController.js
const { PrismaClient } = require('@prisma/client');
const remesasQueue = require('../queues/remesasQueue');
const IORedis = require('ioredis');

const prisma = new PrismaClient();

async function createRemesa(req, res) {
  try {
    const monto = Number(req.body.monto);
    if (isNaN(monto) || monto <= 0) {
      return res.status(400).json({ error: 'El monto debe ser un número mayor que 0' });
    }

    const cuenta_destino = req.body.cuenta_destino;
    if (!cuenta_destino) {
      return res.status(400).json({ error: 'Falta cuenta_destino' });
    }

    const memo = req.body.memo || '';

    // Encolar el job en BullMQ
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

async function listRemesas(req, res) {
  try {
    const remesas = await prisma.transaccion.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(remesas);
  } catch (err) {
    console.error('[Controller] Error en listRemesas:', err);
    return res.status(500).json({ error: 'No se pudo listar remesas' });
  }
}

async function getRemesaStatus(req, res) {
  try {
    const jobId = req.params.jobId;
    const { Worker } = require('bullmq');
    const worker = new Worker(
      'remesas',
      () => {}, // callback vacío porque solo queremos consultar el estado
      { connection: new IORedis(process.env.REDIS_URL) }
    );

    const job = await worker.getJob(jobId);
    const state = job ? await job.getState() : 'not_found';
    return res.json({ jobId, state });
  } catch (err) {
    console.error('[Controller] Error en getRemesaStatus:', err);
    return res.status(500).json({ error: 'No se pudo obtener estado de la remesa' });
  }
}

module.exports = {
  createRemesa,
  listRemesas,
  getRemesaStatus
};
