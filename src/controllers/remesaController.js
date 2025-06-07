// src/controllers/remesaController.js
const { generateTransactionXdr } = require('../services/stellarXdrClient');
const { signXdr } = require('../services/stellarSigningClient');
const { submitToNetwork } = require('../services/stellarSubmitClient');
// submitToNetwork sería un servicio que envía el XDR firmado a Horizon (usando tu propio Horizon client o Stellar SDK)

async function createRemesa(req, res, next) {
  const userToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!userToken) {
    return res.status(401).json({ error: 'Falta token de autorización' });
  }

  try {
    // 1. Extraer del body la data de la remesa que necesitamos para generar XDR
    const { sourcePublicKey, destinationPublicKey, assetCode, assetIssuer, amount, memo } = req.body;
    if (!sourcePublicKey || !destinationPublicKey || !assetCode || !amount) {
      return res.status(400).json({ error: 'Faltan campos obligatorios en solicitud' });
    }

    // 2. Preparar el payload para el XDR Service
    const operations = [
      {
        type: 'payment',
        destination: destinationPublicKey,
        asset: {
          code: assetCode,
          issuer: assetCode === 'XLM' ? null : assetIssuer,
        },
        amount: amount.toString(),
      },
    ];
    const xdrPayload = { sourcePublicKey, memo, operations };

    // 3. Llamar a stellar-xdr-service
    const xdr = await generateTransactionXdr(userToken, xdrPayload);

    // 4. Enviar el XDR al stellar-signing-service para firmarlo
    const signedXdr = await signXdr(userToken, xdr);

    // 5. (Opcional) Subir el XDR firmado a Horizon y obtener el hash de la transacción
    //    Puedes usar Stellar SDK o tu propio servicio. Ejemplo con función submitToNetwork:
    // const submitResponse = await submitToNetwork(signedXdr);

    // 6. Guardar en base de datos la información de la remesa (puedes hacerlo aquí o después del envío real)
    //    Ejemplo simplificado:
    // const nuevaRemesa = await RemesaModel.create({
    //   userId: req.user.id,
    //   sourcePublicKey,
    //   destinationPublicKey,
    //   assetCode,
    //   assetIssuer,
    //   amount,
    //   memo,
    //   xdrUnsigned: xdr,
    //   xdrSigned: signedXdr,
    //   status: 'pending',
    //   txHash: submitResponse.hash
    // });

    // 7. Responder al cliente con el resultado
    return res.status(201).json({
      message: 'Remesa creada exitosamente',
      xdrUnsigned: xdr,
      xdrSigned: signedXdr,
      // txHash: submitResponse.hash
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createRemesa };