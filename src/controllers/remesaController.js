// src/controllers/remesaController.js

require('dotenv').config();
const remesasQueue = require('../queues/remesasQueue');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * POST /api/remesas
 * Encola un job para procesar una remesa.
 */
async function createRemesa(req, res, next) {
  try {
    const userId = req.userId; // set por middleware authenticate
    const { cuenta_destino, monto, memo, assetCode, assetIssuer } = req.body;

    if (!cuenta_destino || monto === undefined) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: cuenta_destino, monto' });
    }

    // Encolamos el job en la cola "remesas"
    const job = await remesasQueue.add('procesar', {
      userId,
      monto: Number(monto),
      cuenta_destino,
      memo: memo || '',
      assetCode,
      assetIssuer
    });

    return res.status(202).json({
      message: 'Remesa encolada para procesamiento',
      jobId: job.id
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/remesas
 * Devuelve todas las remesas procesadas (o en proceso) del usuario.
 */
async function listRemesas(req, res, next) {
  try {
    const userId = req.userId;
    const transacciones = await prisma.transaccion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(transacciones);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/remesas/:jobId
 * Obtiene el detalle y estado de una remesa por su ID.
 */
async function getRemesaStatus(req, res, next) {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.jobId, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'jobId inválido' });
    }

    const record = await prisma.transaccion.findFirst({
      where: { id, userId }
    });

    if (!record) {
      return res.status(404).json({ error: 'Remesa no encontrada' });
    }

    return res.json(record);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRemesa,
  listRemesas,
  getRemesaStatus
};
