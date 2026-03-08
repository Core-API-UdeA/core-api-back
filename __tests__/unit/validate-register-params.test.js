'use strict';

const proxyquire = require('proxyquire').noCallThru();

global.sails = {
  log: {
    debug: jest.fn(),
    error: jest.fn(),
  },
};

const validateRegisterPolicy = proxyquire(
  '../../api/policies/auth/validate-register-params',
  {}
);

function makeReqRes(params) {
  const req = {
    allParams: jest.fn().mockReturnValue(params),
  };
  const res = {
    badRequest:  jest.fn(),
    serverError: jest.fn(),
    status:      jest.fn().mockReturnThis(),
    json:        jest.fn(),
  };
  const proceed = jest.fn();
  return { req, res, proceed };
}

beforeEach(() => jest.clearAllMocks());

describe('validateRegisterParams — Happy Path (proceed llamado)', () => {

  test('VR-01 | Datos mínimos válidos - llama proceed()', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'test@example.com',
      username: 'juanuser',
      password: 'Secure123',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(proceed).toHaveBeenCalledTimes(1);
    expect(res.badRequest).not.toHaveBeenCalled();
  });

  test('VR-02 | Con rol "usuario" válido - llama proceed()', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'otro@mail.com',
      username: 'usertest',
      password: 'Password1',
      rol:      'usuario',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(proceed).toHaveBeenCalledTimes(1);
  });

  test('VR-03 | Con rol "admin" válido - llama proceed()', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'admin@mail.com',
      username: 'adminuser',
      password: 'AdminPass1',
      rol:      'admin',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(proceed).toHaveBeenCalledTimes(1);
  });

  test('VR-04 | Sin campo rol (es opcional) - llama proceed()', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'norol@mail.com',
      username: 'testuser',
      password: 'TestPass1',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(proceed).toHaveBeenCalledTimes(1);
  });

  test('VR-05 | Username exactamente 5 chars (límite inferior) - proceed()', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'min@mail.com',
      username: 'abcde',
      password: 'abcd1234',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(proceed).toHaveBeenCalledTimes(1);
  });

  test('VR-06 | Password exactamente 8 chars (límite inferior) - proceed()', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'p8@mail.com',
      username: 'usermin',
      password: 'abcd1234',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(proceed).toHaveBeenCalledTimes(1);
  });

});

describe('validateRegisterParams — Email inválido', () => {

  test('VR-07 | Email sin @ - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'no-es-un-email',
      username: 'usertest',
      password: 'Password1',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
    expect(proceed).not.toHaveBeenCalled();
  });

  test('VR-08 | Email vacío "" - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    '',
      username: 'usertest',
      password: 'Password1',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
  });

  test('VR-09 | Sin campo email - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      username: 'usertest',
      password: 'Password1',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
  });

});

describe('validateRegisterParams — Username inválido', () => {

  test('VR-10 | Username < 5 chars (4 chars) - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'test@mail.com',
      username: 'abcd',
      password: 'Password1',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
    expect(proceed).not.toHaveBeenCalled();
  });

  test('VR-11 | Username > 60 chars - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'test@mail.com',
      username: 'a'.repeat(61),
      password: 'Password1',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
  });

  test('VR-12 | Username vacío "" - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'test@mail.com',
      username: '',
      password: 'Password1',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
  });

});

describe('validateRegisterParams — Password inválida', () => {

  test('VR-13 | Password < 8 chars (7 chars) - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'test@mail.com',
      username: 'usertest',
      password: 'abc123x',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
    expect(proceed).not.toHaveBeenCalled();
  });

  test('VR-14 | Password > 40 chars - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'test@mail.com',
      username: 'usertest',
      password: 'a'.repeat(41),    // 41 chars
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
  });

  test('VR-15 | Sin campo password - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'test@mail.com',
      username: 'usertest',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
  });

});

describe('validateRegisterParams — Rol inválido', () => {

  test('VR-16 | Rol no permitido "superuser" - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'test@mail.com',
      username: 'usertest',
      password: 'Password1',
      rol:      'superuser',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
    expect(proceed).not.toHaveBeenCalled();
  });

  test('VR-17 | Rol vacío "" - badRequest', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'test@mail.com',
      username: 'usertest',
      password: 'Password1',
      rol:      '',
    });

    await validateRegisterPolicy(req, res, proceed);

    expect(res.badRequest).toHaveBeenCalledTimes(1);
  });

});

describe('validateRegisterParams — Contenido del error', () => {

  test('VR-18 | badRequest recibe objeto con campo "error"', async () => {
    const { req, res, proceed } = makeReqRes({
      email:    'malformat',
      username: 'usertest',
      password: 'Password1',
    });

    await validateRegisterPolicy(req, res, proceed);

    const callArgs = res.badRequest.mock.calls[0][0];
    expect(callArgs).toHaveProperty('error');
  });

});
