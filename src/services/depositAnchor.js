const axios = require('axios');
const { ANCHOR_SERVICE_URL, SECRET_JWT } = process.env;

/**
 * Campos esperados en data:
 * { amount, memo, memoType, assetCode, sender, receiver, externalAccount }
 */
async function depositAnchor(data) {
  const url = `${ANCHOR_SERVICE_URL}/deposit`;
  const resp = await axios.post(
    url,
    data,
    { headers: { Authorization: `Bearer ${SECRET_JWT}` } }
  );
  return resp.data;
}

module.exports = { depositAnchor };