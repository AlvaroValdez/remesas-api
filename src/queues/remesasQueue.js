// src/queues/remesasQueue.js
const { Queue, Worker, Job } = require('bullmq');
const IORedis = require('ioredis');        
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { URLSearchParams } = require('url');

const prisma = new PrismaClient();
const queueName = 'remesas';

// I) Crea un cliente Redis apuntando a REDIS_URL
const connection = { connection: { url: process.env.REDIS_URL } };

// II) Instancia la cola usando esa conexión
const remesasQueue = new Queue(queueName, connection);

// III) Crea el Worker con la misma conexión
new Worker(
  queueName,
  async job => {
    const { userId, monto, cuenta_destino, memo } = job.data;

    // 1) Recupera la publicKey del usuario
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
      {
        source,
        destination: cuenta_destino,
        amount: montoConFee,
        memo,
        network: 'testnet'
      },
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

    // 5) Enviar a Horizon
    const form = new URLSearchParams({ tx: signedXdr }).toString();
    const { data: horizonResp } = await axios.post(
      process.env.HORIZON_URL,
      form,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const txHash = horizonResp.hash;

    // 6) Deposit a través del Anchor
    const { data: anchorResp } = await axios.post(
      process.env.ANCHOR_DEPOSIT_URL,
      { asset_code: 'CLP', account: cuenta_destino, amount: montoConFee },
      { headers: { Authorization: `Bearer ${process.env.ANCHOR_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    const anchorId = anchorResp.deposit_id;

    // 7) Persistir en BD
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

    // Devuelve resultado si lo precisas
    return {
      tx_hash: record.txHash,
      commission: record.commission,
      anchor_id: record.anchorId
    };
  },
  connection
);

module.exports = remesasQueue;