
require('dotenv').config();
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { URLSearchParams } = require('url');

const prisma = new PrismaClient();

const redisUrl = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('No se encontró REDIS_PUBLIC_URL ni REDIS_URL en variables de entorno');
}

const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true
});

const remesasQueue = new Queue('remesas', {
  connection: redisConnection
});

new Worker(
  'remesas',
  async job => {
    const { userId, monto, cuenta_destino, memo } = job.data;

    try {
      // 1) Obtener publicKey del usuario
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { publicKey: true }
      });
      if (!user) throw new Error(`Usuario ${userId} no encontrado`);
      const source = user.publicKey;

      // 2) Cálculo de comisión
      const feeRate = 0.03;
      const commission = parseFloat((monto * feeRate).toFixed(2));
      const montoConFee = parseFloat((monto + commission).toFixed(2));

      // 3) Generar XDR
      const { data: xdrResp } = await axios.post(
        process.env.XDR_SERVICE_URL,
        { source, destination: cuenta_destino, amount: montoConFee, memo, network: 'testnet' },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const { xdr } = xdrResp;

      // 4) Firmar XDR
      const { data: signResp } = await axios.post(
        process.env.SIGNING_SERVICE_URL,
        { xdr },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const { signedXdr } = signResp;

      // 5) Enviar a Horizon y obtener txHash
      const horizonResp = await axios.post(
        'https://horizon-testnet.stellar.org/transactions',
        new URLSearchParams({ tx: signedXdr })
      );
      const txHash = horizonResp.data.hash;

      // 6) Deposit vía Anchor (con manejo de errores)
      let anchorId = null;
      try {
        const { data: anchorResp } = await axios.post(
          process.env.ANCHOR_DEPOSIT_URL,
          { asset_code: 'CLP', account: cuenta_destino, amount: montoConFee },
          {
            headers: {
              Authorization: `Bearer ${process.env.ANCHOR_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        anchorId = anchorResp.deposit_id;
      } catch (anchorError) {
        console.error('Error en depósito Anchor:', anchorError?.response?.data || anchorError.message);
        throw new Error('Fallo en el depósito vía Anchor');
      }

      // 7) Persistir transacción
      const record = await prisma.transaccion.create({
        data: { userId, monto, commission, montoConFee, txHash, anchorId }
      });

      // Retornar resultado
      return {
        tx_hash: record.txHash,
        commission: record.commission,
        anchor_id: record.anchorId
      };

    } catch (err) {
      console.error('Error al procesar job de remesa:', err.message);
      throw err;
    }
  },
  { connection: redisConnection }
);

module.exports = remesasQueue;
