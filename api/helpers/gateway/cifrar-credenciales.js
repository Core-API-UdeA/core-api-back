const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const keyHex = sails.config.custom.gatewayEncryptionKey;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'gatewayEncryptionKey no configurada o inválida. ' +
      'Debe ser un string hex de 64 caracteres (32 bytes).'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

module.exports = {
  friendlyName: 'Cifrar o descifrar credenciales del proveedor',

  description:
    'Cifra un string con AES-256-GCM para almacenamiento seguro, ' +
    'o descifra un string previamente cifrado.',

  inputs: {
    accion: {
      type: 'string',
      isIn: ['cifrar', 'descifrar'],
      required: true,
    },
    valor: {
      type: 'string',
      required: true,
      description:
        'Para cifrar: texto plano (ej: el token del proveedor). ' +
        'Para descifrar: string con formato iv:authTag:ciphertext.',
    },
  },

  fn: async function ({ accion, valor }) {
    const flaverr = require('flaverr');

    try {
      const key = getKey();

      if (accion === 'cifrar') {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const encrypted = Buffer.concat([
          cipher.update(valor, 'utf8'),
          cipher.final(),
        ]);

        const authTag = cipher.getAuthTag();

        return [
          iv.toString('base64'),
          authTag.toString('base64'),
          encrypted.toString('base64'),
        ].join(':');

      } else {
        const partes = valor.split(':');
        if (partes.length !== 3) {
          throw new Error('Formato de credencial cifrada inválido. Se esperan 3 partes separadas por ":".');
        }

        const [ivB64, authTagB64, ciphertextB64] = partes;
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        const ciphertext = Buffer.from(ciphertextB64, 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);

        return decrypted.toString('utf8');
      }

    } catch (error) {
      sails.log.error('Error en cifrar-credenciales:', error.message);
      throw flaverr(
        { code: 'E_CIFRADO', message: 'Error en operación criptográfica' },
        error
      );
    }
  },
};
