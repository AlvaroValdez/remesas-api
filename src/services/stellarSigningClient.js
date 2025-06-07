const axios = require('axios');
const { SIGNING_SERVICE_URL, SECRET_JWT } = process.env;

async function signTransaction(xdr) {
  const url = `${SIGNING_SERVICE_URL}/sign`;
  const resp = await axios.post(
    url,
    { xdr },
    { headers: { Authorization: `Bearer ${SECRET_JWT}` } }
  );
  return resp.data;  // { signedXdr: 'AAAA…' }
}

module.exports = { signTransaction };
