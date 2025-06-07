// src/queues/remesasQueue.js
require('dotenv').config();
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const {
  REDIS_URL,
  XDR_SERVICE_URL,
  SIGNING_SERVICE_URL,
  ANCHOR_SERVICE_URL,
  ANCHOR_TOKEN
} = process.env;

// Validación de variables de entorno
if (!REDIS_URL) throw new Error('REDIS_URL no definido');
if (!XDR_SERVICE_URL) throw new Error('XDR_SERVICE_URL no definido');
if (!SIGNING_SERVICE_URL) throw new Error('SIGNING_SERVICE_URL no definido');
if (!ANCHOR_SERVICE_URL) throw new Error('ANCHOR_DEPOSIT_URL no definido');
if (!ANCHOR_TOKEN) throw new Error('ANCHOR_TOKEN no definido');

// Inicializa Redis y la cola
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true
});
const remesasQueue = new Queue('remesas', { connection });

// Importa los clients que definiste en src/services
const { generateXdr }       = require('../services/stellarXdrClient');
const { signTransaction }   = require('../services/stellarSigningClient');
const { submitTransaction } = require('../services/stellarSubmitClient');
const { depositAnchor }     = require('../services/depositAnchor');

// Worker que procesa jobs
new Worker(
  'remesas',
  async (job) => {
    console.log('[Worker] Recibido job:', job.id, job.data);
    const { userId, monto, cuenta_destino, memo, assetCode, assetIssuer } = job.data;
    if (!userId || !monto || !cuenta_destino) {
      throw new Error('Datos incompletos en job');
    }
    // 1) Obtener publicKey
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicKey: true }
    });
    if (!user) throw new Error(`Usuario ${userId} no existe`);

    // 2) Construir operación
    const operation = {
      type: 'payment',
      asset: assetIssuer
        ? { code: assetCode, issuer: assetIssuer }
        : { code: assetCode || 'XLM' },
      amount: monto.toString(),
      destination: cuenta_destino
    };

    // 3) Generar XDR
    const xdr = await generateXdr({
      sourceAccount: user.publicKey,
      memo: memo || '',
      operations: [operation]
    });

    // 4) Firmar XDR
    const signedXdr = await signTransaction(xdr);

    // 5) Enviar a Horizon
    const txHash = await submitTransaction(signedXdr);

    // 6) Depósito en Anchor
    const anchorId = await depositAnchor({
      account: cuenta_destino,
      amount: monto.toString()
    });

    // 7) Persistir en BD
    const record = await prisma.transaccion.create({
      data: {
        userId,
        monto,
        commission: 0,
        montoConFee: monto,
        txHash,
        anchorId
      }
    });

    console.log('[Worker] Transacción guardada:', record);
    return {
      txHash: record.txHash,
      commission: record.commission,
      anchorId: record.anchorId
    };
  },
  { connection }
);

// Exporta la cola para que remesaController pueda usar remesasQueue.add()
module.exports = remesasQueue;
