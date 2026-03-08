'use strict';

jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

global.sails = {
  log: {
    verbose: jest.fn(),
    debug:   jest.fn(),
    error:   jest.fn(),
  },
  config: {
    jwtSecret:    'test-secret-super-seguro',
    jwtExpiresIn: '4h',
    issuer:       'core-api-auth',
  },
};

const generateHelper = require('../../api/helpers/auth/generate-jwt-token');

async function generateToken(subject) {
  return generateHelper.fn({ subject });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('generateJwtToken — Happy Path', () => {

  test('JWT-01 | Retorna el token que devuelve jwt.sign', async () => {
    jwt.sign.mockReturnValue('mocked-token-abc');

    const subject = { user: { id: 1, email: 'test@mail.com' }, rol: 'usuario' };
    const token = await generateToken(subject);

    expect(token).toBe('mocked-token-abc');
  });

  test('JWT-02 | jwt.sign se llama exactamente 1 vez', async () => {
    jwt.sign.mockReturnValue('tok');
    await generateToken({ user: { id: 1 }, rol: 'usuario' });

    expect(jwt.sign).toHaveBeenCalledTimes(1);
  });

  test('JWT-03 | jwt.sign recibe el secreto correcto de sails.config', async () => {
    jwt.sign.mockReturnValue('tok');
    await generateToken({ user: { id: 5 }, rol: 'admin' });

    const [, secretArg] = jwt.sign.mock.calls[0];
    expect(secretArg).toBe('test-secret-super-seguro');
  });

  test('JWT-04 | El payload contiene sub = user.id cuando viene anidado', async () => {
    jwt.sign.mockReturnValue('tok');
    await generateToken({ user: { id: 42 }, rol: 'usuario' });

    const [payloadArg] = jwt.sign.mock.calls[0];
    expect(payloadArg.sub).toBe(42);
  });

  test('JWT-05 | El payload contiene sub = id cuando viene plano (sin user)', async () => {
    jwt.sign.mockReturnValue('tok');
    await generateToken({ id: 99, rol: 'admin' });

    const [payloadArg] = jwt.sign.mock.calls[0];
    expect(payloadArg.sub).toBe(99);
  });

  test('JWT-06 | El payload lleva el issuer configurado', async () => {
    jwt.sign.mockReturnValue('tok');
    await generateToken({ user: { id: 1 } });

    const [payloadArg] = jwt.sign.mock.calls[0];
    expect(payloadArg.iss).toBe('core-api-auth');
  });

  test('JWT-07 | El payload lleva el rol del subject', async () => {
    jwt.sign.mockReturnValue('tok');
    await generateToken({ user: { id: 1 }, rol: 'admin' });

    const [payloadArg] = jwt.sign.mock.calls[0];
    expect(payloadArg.rol).toBe('admin');
  });

  test('JWT-08 | jwt.sign recibe options.expiresIn = "4h"', async () => {
    jwt.sign.mockReturnValue('tok');
    await generateToken({ user: { id: 1 } });

    const [, , optionsArg] = jwt.sign.mock.calls[0];
    expect(optionsArg.expiresIn).toBe('4h');
  });

});

describe('generateJwtToken — Error Path', () => {

  test('JWT-09 | Cuando jwt.sign lanza error - lanza flaverr con E_AUTH_TOKEN_GENERATION_FAILED', async () => {
    jwt.sign.mockImplementation(() => { throw new Error('signing failed'); });

    await expect(generateToken({ user: { id: 1 } }))
      .rejects
      .toMatchObject({ code: 'E_AUTH_TOKEN_GENERATION_FAILED' });
  });

  test('JWT-10 | Cuando hay error, se registra en sails.log.error', async () => {
    jwt.sign.mockImplementation(() => { throw new Error('fail'); });

    await expect(generateToken({ user: { id: 1 } })).rejects.toBeDefined();

    expect(sails.log.error).toHaveBeenCalledTimes(1);
  });

});

describe('generateJwtToken — Configuración desde process.env', () => {

  test('JWT-11 | Usa process.env.JWT_SECRET si no hay sails.config.jwtSecret', async () => {
    const originalConfig = { ...sails.config };
    sails.config = {};
    process.env.JWT_SECRET = 'env-secret-123';
    jwt.sign.mockReturnValue('tok');

    await generateToken({ user: { id: 1 } });

    const [, secretArg] = jwt.sign.mock.calls[0];
    expect(secretArg).toBe('env-secret-123');

    sails.config = originalConfig;
    delete process.env.JWT_SECRET;
  });

});
