const axios = require('axios');
const { XDR_SERVICE_URL } = process.env;

async function generateXdr(payload) {
  const url = `${XDR_SERVICE_URL}/generate-xdr`;
  const resp = await axios.post(url, payload);
  return resp.data;  // { xdr: 'AAAA…' }
}

module.exports = { generateXdr };