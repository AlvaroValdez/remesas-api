// src/utils/crypto.js
const crypto = require('crypto');

// Usa las mismas variables de .env que en tu signing-service
const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const IV  = Buffer.from(process.env.ENCRYPTION_IV,  'hex');

function encryptSecret(secret) {
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptSecret(encryptedHex) {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encryptSecret, decryptSecret };