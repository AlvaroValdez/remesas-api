// remesaController.js
const { PrismaClient } = require('@prisma/client');
const remesasQueue = require('../queues/remesasQueue');

const prisma = new PrismaClient(); // lee MySQL (Bluehost)

async function createRemesa(req, res) {
  // Toma datos del body y userId de req
  const job = await remesasQueue.add('nueva-remesa', {
    userId: req.userId,
    monto: req.body.monto,
    cuenta_destino: req.body.cuenta_destino,
    memo: req.body.memo
  });
  return res.json({ jobId: job.id });
}

async function listRemesas(req, res) {
  const remesas = await prisma.transaccion.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' }
  });
  return res.json(remesas);
}

async function getRemesaStatus(req, res) {
  const jobId = req.params.jobId;
  const { Worker } = require('bullmq');
  const worker = new Worker('remesas', { connection: new IORedis(process.env.REDIS_URL) });
  const job = await worker.getJob(jobId);
  const state = job ? await job.getState() : 'not_found';
  return res.json({ jobId, state });
}

module.exports = { createRemesa, listRemesas, getRemesaStatus };