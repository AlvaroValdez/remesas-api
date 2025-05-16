const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const IV  = Buffer.from(process.env.ENCRYPTION_IV,  'hex');

function encryptSecret(secret) {
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
  let enc = cipher.update(secret, 'utf8', 'hex');
  enc += cipher.final('hex');
  return enc;
}

function decryptSecret(encHex) {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
  let dec = decipher.update(encHex, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

module.exports = { encryptSecret, decryptSecret };