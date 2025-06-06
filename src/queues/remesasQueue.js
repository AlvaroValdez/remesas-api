// src/queues/remesasQueue.js

require('dotenv').config();
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ----------------------------------------------------
// 1. Validación de variables de entorno al inicio
// ----------------------------------------------------
const {
  REDIS_URL,
  XDR_SERVICE_URL,
  SIGNING_SERVICE_URL,
  ANCHOR_DEPOSIT_URL,
  ANCHOR_TOKEN
} = process.env;

if (!REDIS_URL) {
  throw new Error('REDIS_URL no definido en el entorno');
}
if (!XDR_SERVICE_URL) {
  throw new Error('XDR_SERVICE_URL no definido en el entorno');
}
if (!SIGNING_SERVICE_URL) {
  throw new Error('SIGNING_SERVICE_URL no definido en el entorno');
}
if (!ANCHOR_DEPOSIT_URL) {
  throw new Error('ANCHOR_DEPOSIT_URL no definido en el entorno');
}
if (!ANCHOR_TOKEN) {
  throw new Error('ANCHOR_TOKEN no definido en el entorno');
}

// ----------------------------------------------------
// 2. Conexión a Redis y creación de la cola "remesas"
// ----------------------------------------------------
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
});

const remesasQueue = new Queue('remesas', { connection });

// ------------------------------------------------------------------
// 3. Funciones auxiliares para cada paso (XDR, firma, envío, etc.)
// ------------------------------------------------------------------

/**
 * Genera XDR a partir de la información de la transacción.
 * @param {string} sourceCli - PublicKey de la cuenta origen.
 * @param {Array<Object>} operations - Lista de operaciones (each { type, asset: {code, issuer?}, amount, destination }).
 * @param {string} memo - Memo opcional.
 * @returns {Promise<string>} XDR en base64.
 */
async function generateXDR(sourceCli, operations, memo) {
  try {
    const payload = {
      sourceAccount: sourceCli,
      memo: memo || '',
      operations,
    };
    console.log('[XDR] Solicitando XDR con payload:', JSON.stringify(payload));

    const response = await axios.post(
      `${XDR_SERVICE_URL}/generate-xdr`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data.xdr;
  } catch (err) {
    console.error(
      '[XDR] Error generando XDR:',
      err.response?.data || err.message || err
    );
    throw new Error('Fallo generando XDR');
  }
}

/**
 * Firma un XDR usando el servicio de firma.
 * @param {string} xdr - XDR en base64 sin firmar.
 * @returns {Promise<string>} XDR firmado en base64.
 */
async function signXDR(xdr) {
  try {
    console.log('[Sign] Solicitando firma para XDR:', xdr);
    const response = await axios.post(
      `${SIGNING_SERVICE_URL}/sign`,
      { xdr },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data.signedXdr;
  } catch (err) {
    console.error('[Sign] Error firmando XDR:', err.response?.data || err.message || err);
    throw new Error('Fallo firmando XDR');
  }
}

/**
 * Envía un XDR firmado a Horizon (u otro endpoint de envío) y retorna txHash.
 * @param {string} signedXdr - XDR en base64 firmado.
 * @returns {Promise<string>} txHash (hash de la transacción).
 */
async function submitTransaction(signedXdr) {
  try {
    console.log('[Submit] Enviando XDR firmado a Horizon');
    const response = await axios.post(
      `${XDR_SERVICE_URL}/submit`,
      { signedXdr },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data.txHash;
  } catch (err) {
    console.error(
      '[Submit] Error enviando transacción:',
      err.response?.data || err.message || err
    );
    throw new Error('Fallo enviando transacción a Horizon');
  }
}

/**
 * Realiza el depósito vía Anchor y retorna anchorId.
 * @param {string} destination - Cuenta destinataria en Anchor.
 * @param {string} amount - Monto a depositar.
 * @returns {Promise<string>} anchorId (ID del depósito).
 */
async function depositAnchor(destination, amount) {
  try {
    console.log('[Anchor] Solicitando depósito Anchor para destino:', destination, 'monto:', amount);
    const response = await axios.post(
      ANCHOR_DEPOSIT_URL,
      {
        asset_code: 'CLP',   // Ajustar según el asset que uses
        account: destination,
        amount,
      },
      {
        headers: {
          Authorization: `Bearer ${ANCHOR_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.deposit_id;
  } catch (err) {
    console.error(
      '[Anchor] Error en depósito Anchor:',
      err.response?.data || err.message || err
    );
    throw new Error('Fallo en depósito vía Anchor');
  }
}

/**
 * Persiste la transacción en la base de datos.
 * @param {Object} data - Objeto con userId, monto, commission, montoConFee, txHash, anchorId.
 * @returns {Promise<Object>} Registro guardado.
 */
async function persistTransaction({ userId, monto, commission, montoConFee, txHash, anchorId }) {
  try {
    console.log(
      '[DB] Persistiendo transacción en BD:',
      { userId, monto, commission, montoConFee, txHash, anchorId }
    );
    const record = await prisma.transaccion.create({
      data: {
        userId,
        monto,
        commission,
        montoConFee,
        txHash,
        anchorId,
      },
    });
    return record;
  } catch (err) {
    console.error('[DB] Error persistiendo transacción:', err);
    throw new Error('Fallo guardando transacción en BD');
  }
}

// ------------------------------------------------------------------
// 4. Worker que procesa cada job en la cola "remesas"
// ------------------------------------------------------------------
new Worker(
  'remesas',
  async (job) => {
    console.log('[Worker] Recibido job:', job.id, 'data:', job.data);

    const { userId, monto, cuenta_destino, memo, assetCode, assetIssuer } = job.data;

    // Validaciones básicas
    if (!userId || !monto || !cuenta_destino) {
      throw new Error('Datos incompletos en job: se requiere userId, monto y cuenta_destino');
    }

    // 1) Obtener publicKey
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicKey: true },
    });
    if (!user) {
      throw new Error(`[Worker] Usuario no encontrado (ID=${userId})`);
    }
    console.log(`[Worker] Usuario ${userId} -> publicKey ${user.publicKey}`);

    // 2) Construir la operación (soporte dinámico de asset)
    const operation = {
      type: 'payment',
      asset: assetIssuer
        ? { code: assetCode, issuer: assetIssuer }
        : { code: assetCode || 'XLM' }, // Si no hay issuer, se asume XLM nativo
      amount: monto.toString(),
      destination: cuenta_destino,
    };

    // 3) Generar XDR
    const xdr = await generateXDR(user.publicKey, [operation], memo);

    // 4) Firmar XDR
    const signedXdr = await signXDR(xdr);

    // 5) Enviar transacción firmada a Horizon
    const txHash = await submitTransaction(signedXdr);

    // 6) Deposit vía Anchor
    const anchorId = await depositAnchor(cuenta_destino, monto.toString());

    // 7) Calcular comisión y monto neto (aquí se asume comision = 0)
    const commission = 0;
    const montoConFee = monto;

    // 8) Persistir la transacción en BD
    const record = await persistTransaction({
      userId,
      monto,
      commission,
      montoConFee,
      txHash,
      anchorId,
    });

    console.log('[Worker] Transacción finalizada exitosamente:', record);
    return {
      txHash: record.txHash,
      commission: record.commission,
      anchorId: record.anchorId,
    };
  },
  {
    connection,
    // Aquí podrías agregar opciones adicionales, p.ej.:
    // maxStalledCount: 3,
    // backoff strategies (lógica de reintentos), etc.
  }
);

module.exports = remesasQueue;