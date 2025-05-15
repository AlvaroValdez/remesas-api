const axios = require('axios');

async function createRemesa(req, res) {
  const payload = req.body;
  const n8nUrl = process.env.N8N_WEBHOOK_URL;

  if (!n8nUrl) {
    console.error('❌ N8N_WEBHOOK_URL no está definido en las vars de entorno');
    return res.status(500).json({ error: 'Configuración interna faltante' });
  }

  try {
    console.log('▶️ Invocando n8n en:', n8nUrl, 'con payload:', payload);
    const response = await axios.post(n8nUrl, payload);
    console.log('✅ n8n respondió:', response.status, response.data);
    return res.status(response.status).json(response.data);
  } catch (err) {
    // Log completo del error
    console.error('❌ Error en remesaController:', {
      message: err.message,
      status: err.response?.status,
      data:    err.response?.data,
      stack:   err.stack,
    });
    const errorMessage = err.response?.data?.error || err.message;
    return res.status(500).json({ error: errorMessage });
  }
}

module.exports = { createRemesa };