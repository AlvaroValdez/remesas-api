// src/controllers/remesaController.js
require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const remesasQueue = require('../queues/remesasQueue');
const { Job } = require('bullmq');

const prisma = new PrismaClient();

// POST /api/remesas
async function createRemesa(req, res) {
  const { monto, cuenta_destino, memo } = req.body;
  const userId = req.userId;

  try {
    // Encola la remesa en la cola de BullMQ
    const job = await remesasQueue.add('procesar', { userId, monto, cuenta_destino, memo });
    return res.json({ jobId: job.id, status: 'queued' });
  } catch (err) {
    console.error('createRemesa error:', err);
    return res.status(500).json({ error: 'Error al encolar la remesa' });
  }
}

// GET /api/remesas
async function listRemesas(req, res) {
  try {
    const remesas = await prisma.transaccion.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(remesas);
  } catch (err) {
    console.error('listRemesas error:', err);
    return res.status(500).json({ error: 'No se pudo obtener historial' });
  }
}

// GET /api/remesas/:jobId
async function getRemesaStatus(req, res) {
  const jobId = req.params.jobId;
  try {
    const job = await Job.fromId(remesasQueue, jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job no encontrado' });
    }
    const state = await job.getState();
    const result = job.returnvalue;
    return res.json({ jobId, state, result });
  } catch (err) {
    console.error('getRemesaStatus error:', err);
    return res.status(500).json({ error: 'Error al consultar estado del job' });
  }
}

module.exports = { createRemesa, listRemesas, getRemesaStatus };