require('dotenv').config();
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { URLSearchParams } = require('url');

const prisma = new PrismaClient();  
// ↳ Usa la misma DATABASE_URL (Bluehost) para guardar Transacciones.

const redisUrl = process.env.REDIS_URL; 
if (!redisUrl) throw new Error('REDIS_URL no definido');

const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true
});

const remesasQueue = new Queue('remesas', { connection: redisConnection });

new Worker('remesas', async job => {
  const { userId, monto, cuenta_destino, memo } = job.data;

  // 1) Obtener publicKey de usuario (Bluehost DB)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { publicKey: true }
  });
  // … rest of logic: generar XDR, firmar, enviar, depositar vía Anchor, persistir transacción …
  // 7) Persistir transacción en MySQL (Bluehost):
  const record = await prisma.transaccion.create({
    data: { userId, monto, commission, montoConFee, txHash, anchorId }
  });

  return { tx_hash: record.txHash, commission: record.commission, anchor_id: record.anchorId };
}, { connection: redisConnection });

module.exports = remesasQueue;