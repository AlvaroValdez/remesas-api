// src/queues/remesasQueue.js
require('dotenv').config();
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL no definido en el entorno');

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true
});

const remesasQueue = new Queue('remesas', { connection });

// Aquí instanciamos el Worker que “escucha” la cola
new Worker(
  'remesas',
  async (job) => {
    console.log('[Worker] Recibido job:', job.id, 'data:', job.data);

    try {
      const { userId, monto, cuenta_destino, memo } = job.data;

      // 1) Obtener publicKey
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { publicKey: true }
      });
      if (!user) {
        console.error(`[Worker] Usuario no encontrado (ID=${userId}). Abortando job ${job.id}`);
        return;
      }
      console.log(`[Worker] Usuario ${userId} -> publicKey ${user.publicKey}`);

      // 2) Llamar a stellar-xdr-service para generar XDR
      const xdrResp = await axios.post(
        `${process.env.XDR_SERVICE_URL}/generate`,
        {
          source: user.publicKey,
          destination: cuenta_destino,
          amount: monto.toString(),
          memo: memo || ''
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const { xdr } = xdrResp.data;
      console.log(`[Worker] XDR generado:`, xdr);

      // 3) Llamar a stellar-signing-service para firmar XDR
      const signResp = await axios.post(
        `${process.env.SIGNING_SERVICE_URL}/sign`,
        { xdr },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const { signedXdr } = signResp.data;
      console.log(`[Worker] XDR firmado:`, signedXdr);

      // 4) Enviar transacción firmada a Horizon (o el endpoint que uses)
      const submitResp = await axios.post(
        `${process.env.XDR_SERVICE_URL}/submit`,
        { signedXdr },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const { txHash } = submitResp.data;
      console.log(`[Worker] Transacción enviada. txHash:`, txHash);

      // 5) Deposit vía Anchor
      const anchorResp = await axios.post(
        process.env.ANCHOR_DEPOSIT_URL,
        { asset_code: 'CLP', account: cuenta_destino, amount: monto.toString() },
        { headers: { Authorization: `Bearer ${process.env.ANCHOR_TOKEN}`, 'Content-Type': 'application/json' } }
      );
      const anchorId = anchorResp.data.deposit_id;
      console.log(`[Worker] Deposit Anchor ID:`, anchorId);

      // 6) Persistir transacción en BD
      const commission = 0;        // Ajusta según cálculo real
      const montoConFee = monto;   // Ajusta si añades fee real
      const record = await prisma.transaccion.create({
        data: {
          userId,
          monto,
          commission,
          montoConFee,
          txHash,
          anchorId
        }
      });
      console.log(`[Worker] Transacción guardada en BD:`, record);

      return { txHash: record.txHash, commission: record.commission, anchorId: record.anchorId };
    } catch (err) {
      console.error('[Worker] Error procesando job', job.id, err);
      throw err;
    }
  },
  { connection }
);

module.exports = remesasQueue;