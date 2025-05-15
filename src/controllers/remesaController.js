const axios = require('axios');

async function createRemesa(req, res) {
  try {
    const payload = req.body;
    // Aquí podrías validar el payload (monto, moneda, datos de destinatario, etc.)

    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    const response = await axios.post(n8nUrl, payload);

    // Devuelve la respuesta de n8n al front
    return res.status(response.status).json(response.data);
  } catch (err) {
    console.error('Error en remesaController:', err.message);
    return res.status(500).json({ error: 'Error interno al procesar remesa' });
  }
}

module.exports = { createRemesa };