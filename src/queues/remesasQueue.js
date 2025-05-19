// src/queues/remesasQueue.js
const { Queue, Worker, Job } = require('bullmq');
const IORedis = require('ioredis');

// Conexión desde REDIS_URL
const connection = new IORedis(process.env.REDIS_URL);

// La cola donde encolamos las remesas
const remesasQueue = new Queue('remesas', { connection });

// Worker: procesa cada job en secuencia
new Worker('remesas', async job => {
  const { userId, monto, cuenta_destino, memo } = job.data;
  
  // 1) Calcular comisión
  const feeRate      = 0.03;
  const commission   = monto * feeRate;
  const montoConFee  = monto + commission;

  // 2) Generar XDR
  const { data: { xdr }} = await axios.post(
    process.env.XDR_SERVICE_URL,
    { source: /* tu lógica */, destination: cuenta_destino, amount: montoConFee, memo, network: 'testnet' }
  );

  // 3) Firmar XDR
  const { data: { signedXdr }} = await axios.post(
    process.env.SIGNING_SERVICE_URL,
    { xdr }
  );

  // 4) Enviar a Horizon
  const txResponse = await axios.post(
    process.env.HORIZON_URL,
    new URLSearchParams({ tx: signedXdr }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  // 5) Deposit via Anchor
  const { data: deposit } = await axios.post(
    process.env.ANCHOR_DEPOSIT_URL,
    { asset_code: 'CLP', account: cuenta_destino, amount: montoConFee },
    { headers: { Authorization: `Bearer ${process.env.ANCHOR_TOKEN}` } }
  );

  // 6) Persistir en BD
  const record = await prisma.transaccion.create({
    data: {
      userId,
      monto,
      commission,
      montoConFee,
      txHash:   txResponse.data.hash,
      anchorId: deposit.deposit_id,
    }
  });

  // Devuelve resultado al cliente si lo desea
  return {
    tx_hash:   record.txHash,
    commission,
    anchor_id: record.anchorId,
  };
}, { connection });

module.exports = remesasQueue;