'use strict';

/**
 * __tests__/unit/cifrar-credenciales.test.js
 *
 * Cobertura del helper api/helpers/gateway/cifrar-credenciales.js
 * Usa crypto real de Node.js — sin mocks de módulos crypto.
 */

const VALID_KEY_HEX = 'a'.repeat(64); // 32 bytes válidos en hex

global.sails = {
  log: {
    verbose: jest.fn(),
    error:   jest.fn(),
  },
  config: {
    custom: {
      gatewayEncryptionKey: VALID_KEY_HEX,
    },
  },
};

const helper = require('../../api/helpers/gateway/cifrar-credenciales');

async function cifrar(valor) {
  return helper.fn({ accion: 'cifrar', valor });
}

async function descifrar(valor) {
  return helper.fn({ accion: 'descifrar', valor });
}

beforeEach(() => {
  jest.clearAllMocks();
  sails.config.custom.gatewayEncryptionKey = VALID_KEY_HEX;
});

// ─── Happy Path: cifrar ───────────────────────────────────────────────────────

describe('cifrarCredenciales — accion: cifrar', () => {

  test('CC-01 | Retorna un string con formato iv:authTag:ciphertext', async () => {
    const resultado = await cifrar('mi-api-key-secreta');
    const partes = resultado.split(':');
    expect(partes).toHaveLength(3);
  });

  test('CC-02 | Cada parte del resultado es base64 válido no vacío', async () => {
    const resultado = await cifrar('token-123');
    const [iv, authTag, ciphertext] = resultado.split(':');
    expect(iv.length).toBeGreaterThan(0);
    expect(authTag.length).toBeGreaterThan(0);
    expect(ciphertext.length).toBeGreaterThan(0);
  });

  test('CC-03 | Dos cifrados del mismo valor producen resultados distintos (IV aleatorio)', async () => {
    const r1 = await cifrar('mismo-valor');
    const r2 = await cifrar('mismo-valor');
    expect(r1).not.toBe(r2);
  });

  test('CC-04 | Cifra string vacío sin lanzar error', async () => {
    const resultado = await cifrar('');
    expect(resultado.split(':')).toHaveLength(3);
  });

  test('CC-05 | Cifra strings largos (> 1000 chars)', async () => {
    const valorLargo = 'x'.repeat(1500);
    const resultado = await cifrar(valorLargo);
    expect(resultado.split(':')).toHaveLength(3);
  });

  test('CC-06 | Cifra caracteres especiales y unicode', async () => {
    const resultado = await cifrar('🔑 clave con ñ y tildes: áéíóú');
    expect(resultado.split(':')).toHaveLength(3);
  });

});

// ─── Happy Path: descifrar ────────────────────────────────────────────────────

describe('cifrarCredenciales — accion: descifrar', () => {

  test('CC-07 | Descifrar lo que fue cifrado retorna el valor original', async () => {
    const original = 'mi-token-secreto-12345';
    const cifrado  = await cifrar(original);
    const resultado = await descifrar(cifrado);
    expect(resultado).toBe(original);
  });

  test('CC-08 | Descifrar string vacío cifrado retorna string vacío', async () => {
    const cifrado  = await cifrar('');
    const resultado = await descifrar(cifrado);
    expect(resultado).toBe('');
  });

  test('CC-09 | Descifrar string largo retorna el valor original', async () => {
    const original = 'Bearer ' + 'a'.repeat(500);
    const cifrado  = await cifrar(original);
    const resultado = await descifrar(cifrado);
    expect(resultado).toBe(original);
  });

  test('CC-10 | Descifrar preserva caracteres unicode', async () => {
    const original = 'clave-con-ñ-áéíóú-🔑';
    const cifrado  = await cifrar(original);
    const resultado = await descifrar(cifrado);
    expect(resultado).toBe(original);
  });

});

// ─── Error Path: clave inválida ───────────────────────────────────────────────

describe('cifrarCredenciales — clave inválida', () => {

  test('CC-11 | Clave vacía lanza E_CIFRADO', async () => {
    sails.config.custom.gatewayEncryptionKey = '';
    await expect(cifrar('valor')).rejects.toMatchObject({ code: 'E_CIFRADO' });
  });

  test('CC-12 | Clave de longitud incorrecta (< 64 hex) lanza E_CIFRADO', async () => {
    sails.config.custom.gatewayEncryptionKey = 'abc123';
    await expect(cifrar('valor')).rejects.toMatchObject({ code: 'E_CIFRADO' });
  });

  test('CC-13 | Clave undefined lanza E_CIFRADO', async () => {
    sails.config.custom.gatewayEncryptionKey = undefined;
    await expect(cifrar('valor')).rejects.toMatchObject({ code: 'E_CIFRADO' });
  });

  test('CC-14 | Cuando hay error, se llama sails.log.error', async () => {
    sails.config.custom.gatewayEncryptionKey = '';
    await expect(cifrar('valor')).rejects.toBeDefined();
    expect(sails.log.error).toHaveBeenCalledTimes(1);
  });

});

// ─── Error Path: formato de descifrado inválido ───────────────────────────────

describe('cifrarCredenciales — formato de descifrado inválido', () => {

  test('CC-15 | String sin separadores ":" lanza E_CIFRADO', async () => {
    await expect(descifrar('nocolombo')).rejects.toMatchObject({ code: 'E_CIFRADO' });
  });

  test('CC-16 | Solo dos partes (falta ciphertext) lanza E_CIFRADO', async () => {
    await expect(descifrar('parte1:parte2')).rejects.toMatchObject({ code: 'E_CIFRADO' });
  });

  test('CC-17 | Cuatro partes (demasiadas) lanza E_CIFRADO', async () => {
    await expect(descifrar('a:b:c:d')).rejects.toMatchObject({ code: 'E_CIFRADO' });
  });

  test('CC-18 | Formato válido pero datos corruptos lanza E_CIFRADO', async () => {
    // Base64 sintácticamente válido pero criptográficamente corrupto
    const corrupto = 'AAAA:BBBB:CCCC';
    await expect(descifrar(corrupto)).rejects.toMatchObject({ code: 'E_CIFRADO' });
  });

  test('CC-19 | String vacío como valor a descifrar lanza E_CIFRADO', async () => {
    await expect(descifrar('')).rejects.toMatchObject({ code: 'E_CIFRADO' });
  });

});

// ─── Integridad: cifrar con una key, descifrar con otra falla ─────────────────

describe('cifrarCredenciales — integridad de clave', () => {

  test('CC-20 | Descifrar con clave distinta a la que cifró lanza E_CIFRADO', async () => {
    const cifrado = await cifrar('secreto');

    // Cambiar la clave antes de descifrar
    sails.config.custom.gatewayEncryptionKey = 'b'.repeat(64);

    await expect(descifrar(cifrado)).rejects.toMatchObject({ code: 'E_CIFRADO' });
  });

});
