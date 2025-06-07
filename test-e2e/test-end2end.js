// test-end2end.js
require('dotenv').config({ path: '.env.test' });
const axios = require('axios');
const jwt = require('jsonwebtoken');

const {
  REMESAS_API_URL,
  SECRET_JWT,
  TEST_USER_ID,
  TEST_DESTINATION,
  TEST_AMOUNT
} = process.env;

if (!REMESAS_API_URL || !SECRET_JWT || !TEST_USER_ID || !TEST_DESTINATION || !TEST_AMOUNT) {
  console.error('❌ Faltan variables en .env.test');
  process.exit(1);
}

// 1) Genera un JWT válido para el userId de prueba
const token = jwt.sign(
  { userId: Number(TEST_USER_ID) },
  SECRET_JWT,
  { expiresIn: '1h' }
);

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  try {
    console.log('1) Encolando remesa…');
    const createRes = await axios.post(
      `${REMESAS_API_URL}/api/remesas`,
      {
        cuenta_destino: TEST_DESTINATION,
        monto: Number(TEST_AMOUNT),
        memo: 'Prueba E2E',
        assetCode: 'XLM'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const jobId = createRes.data.jobId;
    console.log('   → jobId:', jobId);

    console.log('\n2) Haciendo polling del estado…');
    let record;
    for (let i = 0; i < 15; i++) {
      await sleep(2000);
      const statusRes = await axios.get(
        `${REMESAS_API_URL}/api/remesas/${jobId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      record = statusRes.data;
      console.log(`   [Intento ${i + 1}]`, record);
      if (record.txHash && record.anchorId) {
        console.log('\n✅ Operación completada:');
        console.log(`   • txHash: ${record.txHash}`);
        console.log(`   • anchorId: ${record.anchorId}`);
        console.log(`   • Comisión: ${record.commission}`);
        return;
      }
    }

    throw new Error('⏰ Timeout: la transacción no se completó en el tiempo esperado');
  } catch (err) {
    console.error('❌ Error en E2E:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();