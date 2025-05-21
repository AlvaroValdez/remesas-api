// src/controllers/anchorController.js
require('dotenv').config();
const axios = require('axios');

// POST /api/anchor/deposit
async function initDeposit(req, res) {
  try {
    const { amount, assetCode } = req.body;
    const userId = req.userId;       // middleware de auth ya puso req.userId
    if (!amount || !assetCode) {
      return res.status(400).json({ error: 'Faltan campos: amount, assetCode' });
    }

    // Prepara el payload SEP-24
    const payload = {
      account_id: req.userPublicKey,  // tu middleware debe exponer la publicKey
      asset_code: assetCode,
      amount: amount.toString(),
      // opcional: memo, dest_extra, etc.
    };

    // Llama al Anchor
    const response = await axios.post(
      process.env.ANCHOR_DEPOSIT_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ANCHOR_TOKEN}`
        }
      }
    );

    // Devuelve al front la URL con la que el usuario completará el depósito
    const { url, id, ...rest } = response.data;
    return res.json({ url, id, ...rest });
  } catch (err) {
    console.error('initDeposit error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const msg    = err.response?.data?.error || 'Error iniciando depósito';
    return res.status(status).json({ error: msg });
  }
}

module.exports = { initDeposit };