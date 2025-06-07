// src/queues/remesasQueue.js

const { generateXdr }       = require('../services/stellarXdrClient');
const { signTransaction }   = require('../services/stellarSigningClient');
const { submitTransaction } = require('../services/stellarSubmitClient');
const { depositAnchor }     = require('../services/depositAnchor');


require('dotenv').config();
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const {
  REDIS_URL,
  XDR_SERVICE_URL,
  SIGNING_SERVICE_URL,
  ANCHOR_DEPOSIT_URL,
  ANCHOR_TOKEN
} = process.env;

if (!REDIS_URL) throw new Error('REDIS_URL no definido');
if (!XDR_SERVICE_URL) throw new Error('XDR_SERVICE_URL no definido');
if (!SIGNING_SERVICE_URL) throw new Error('SIGNING_SERVICE_URL no definido');
if (!ANCHOR_DEPOSIT_URL) throw new Error('ANCHOR_DEPOSIT_URL no definido');
if (!ANCHOR_TOKEN) throw new Error('ANCHOR_TOKEN no definido');

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true
});
const remesasQueue = new Queue('remesas', { connection });

/** Genera XDR */
async function generateXDR(sourceCli, operations, memo) {
  try {
    const payload = { sourceAccount: sourceCli, memo: memo || '', operations };
    console.log('[XDR] Payload:', payload);
    const { data } = await axios.post(
      `${XDR_SERVICE_URL}/generate-xdr`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    return data.xdr;
  } catch (err) {
    console.error('[XDR] Error:', err.response?.data || err.message || err);
    throw new Error('Fallo generando XDR');
  }
}

/** Firma XDR */
async function signXDR(xdr) {
  try {
    console.log('[Sign] XDR a firmar:', xdr);
    const { data } = await axios.post(
      `${SIGNING_SERVICE_URL}/sign`,
      { xdr },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return data.signedXdr;
  } catch (err) {
    console.error('[Sign] Error:', err.response?.data || err.message || err);
    throw new Error('Fallo firmando XDR');
  }
}

/** Envía transacción a Horizon */
async function submitTransaction(signedXdr) {
  try {
    console.log('[Submit] Enviando a Horizon');
    const { data } = await axios.post(
      `${XDR_SERVICE_URL}/submit`,
      { signedXdr },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return data.txHash;
  } catch (err) {
    console.error('[Submit] Error:', err.response?.data || err.message || err);
    throw new Error('Fallo enviando a Horizon');
  }
}

/** Depósito vía Anchor */
async function depositAnchor(destination, amount) {
  try {
    console.log('[Anchor] Depositando', destination, amount);
    const { data } = await axios.post(
      ANCHOR_DEPOSIT_URL,
      { asset_code: 'CLP', account: destination, amount },
      {
        headers: {
          Authorization: `Bearer ${ANCHOR_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return data.deposit_id;
  } catch (err) {
    console.error('[Anchor] Error:', err.response?.data || err.message || err);
    throw new Error('Fallo depósito Anchor');
  }
}

/** Persistir en BD */
async function persistTransaction({ userId, monto, commission, montoConFee, txHash, anchorId }) {
  try {
    console.log('[DB] Guardando transacción:', { userId, monto, commission, montoConFee, txHash, anchorId });
    return await prisma.transaccion.create({
      data: { userId, monto, commission, montoConFee, txHash, anchorId }
    });
  } catch (err) {
    console.error('[DB] Error:', err);
    throw new Error('Fallo guardando en BD');
  }
}

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
    const xdr = await generateXDR(user.publicKey, [operation], memo);

    // 4) Firmar XDR
    const signedXdr = await signXDR(xdr);

    // 5) Enviar a Horizon
    const txHash = await submitTransaction(signedXdr);

    // 6) Depósito Anchor
    const anchorId = await depositAnchor(cuenta_destino, monto.toString());

    // 7) Calcular comisiones (por ahora = 0)
    const commission = 0;
    const montoConFee = monto;

    // 8) Persistir en BD
    const record = await persistTransaction({
      userId,
      monto,
      commission,
      montoConFee,
      txHash,
      anchorId
    });

    console.log('[Worker] Transacción guardada:', record);
    return { txHash: record.txHash, commission: record.commission, anchorId: record.anchorId };
  },
  { connection }
);

module.exports = remesasQueue;