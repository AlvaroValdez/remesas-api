const axios = require('axios');
const { XDR_SERVICE_URL } = process.env;

async function submitTransaction(signedXdr) {
  const url = `${XDR_SERVICE_URL}/submit`;
  const resp = await axios.post(url, { xdr: signedXdr });
  return resp.data;  // resultado de Horizon
}

module.exports = { submitTransaction };