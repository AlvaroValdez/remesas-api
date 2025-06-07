// src/controllers/anchorController.js
require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const remesasQueue = require('../queues/remesasQueue');

const prisma = new PrismaClient();

// POST /api/anchor/deposit
async function initDeposit(req, res) {
  try {
    const { amount, assetCode } = req.body;
    const userId = req.userId;

    if (!amount || !assetCode) {
      return res.status(400).json({ error: 'Faltan campos: amount, assetCode' });
    }

    // Construir payload SEP-24
    const payload = {
      account_id: req.userPublicKey,
      asset_code: assetCode,
      amount: amount.toString(),
    };

    // Llamada al Anchor SEP-24
    const response = await axios.post(
      process.env.ANCHOR_SERVICE_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ANCHOR_TOKEN}`
        }
      }
    );

    const { url, id, ...rest } = response.data;
    return res.json({ url, id, ...rest });
  } catch (err) {
    console.error('initDeposit error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const msg = err.response?.data?.error || 'Error iniciando depósito';
    return res.status(status).json({ error: msg });
  }
}

// POST /api/anchor/callback
async function handleDepositCallback(req, res) {
  try {
    const callbackData = req.body;
    console.log('Anchor deposit callback recibida:', callbackData);

    const { id, status, amount, account_id } = callbackData;
    if (status !== 'completed') {
      return res.status(200).send('Callback recibido');
    }

    // Buscar usuario por publicKey
    const user = await prisma.user.findUnique({
      where: { publicKey: account_id },
      select: { id: true }
    });
    if (!user) {
      console.warn(`Usuario con publicKey ${account_id} no encontrado`);
      return res.status(404).send('User not found');
    }

    // Encolar job para procesar on-chain
    await remesasQueue.add('procesar', {
      userId: user.id,
      monto: Number(amount),
      cuenta_destino: callbackData.destination_account || account_id,
      memo: id
    });

    return res.status(200).send('Encolado');
  } catch (err) {
    console.error('handleDepositCallback error:', err);
    return res.status(500).send('Error interno');
  }
}

module.exports = { initDeposit, handleDepositCallback };