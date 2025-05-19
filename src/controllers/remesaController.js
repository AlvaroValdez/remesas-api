// src/controllers/remesaController.js
const remesasQueue = require('../queues/remesasQueue');
const { Job }      = require('bullmq');

async function createRemesa(req, res) {
  const { monto, cuenta_destino, memo } = req.body;
  const userId = req.userId;

  // Añade el job y devuelve el ID al front
 const job = await remesasQueue.add('procesar', {
  userId: req.userId,
  monto,
  cuenta_destino,
  memo
});
return res.json({ jobId: job.id });

}

// Opcional: endpoint para chequear estado
async function getRemesaStatus(req, res) {
  const jobId = req.params.jobId;
  const job   = await Job.fromId(remesasQueue, jobId);
  if (!job) return res.status(404).json({ error: 'Job no encontrado' });

  const state = await job.getState();      // 'completed', 'failed', 'waiting'...
  const result = job.returnvalue;          // solo si ya acabó
  return res.json({ jobId, state, result });
}

module.exports = { createRemesa, getRemesaStatus };