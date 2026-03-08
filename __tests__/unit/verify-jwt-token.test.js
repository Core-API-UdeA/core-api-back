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
    jwtSecret: 'test-secret-super-seguro',
  },
};

const verifyHelper = require('../../api/helpers/auth/verify-jwt-token');

async function verifyToken(token) {
  return verifyHelper.fn({ token });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('verifyJwtToken — Token válido', () => {

  test('VT-01 | Retorna el payload decodificado cuando el token es válido', async () => {
    const mockPayload = {
      sub: 1, iss: 'core-api-auth', rol: 'usuario',
      user: { id: 1, email: 'test@mail.com' },
    };
    jwt.verify.mockReturnValue(mockPayload);
    const result = await verifyToken('valid.jwt.token');
    expect(result).toEqual(mockPayload);
  });

  test('VT-02 | jwt.verify se llama con el token y el secreto correcto', async () => {
    jwt.verify.mockReturnValue({ sub: 1 });
    await verifyToken('some.token.here');
    expect(jwt.verify).toHaveBeenCalledWith('some.token.here', 'test-secret-super-seguro');
  });

  test('VT-03 | El resultado contiene el campo sub', async () => {
    jwt.verify.mockReturnValue({ sub: 7, rol: 'admin' });
    const result = await verifyToken('tok');
    expect(result).toHaveProperty('sub', 7);
  });

  test('VT-04 | No llama sails.log.error cuando el token es válido', async () => {
    jwt.verify.mockReturnValue({ sub: 1 });
    await verifyToken('valid');
    expect(sails.log.error).not.toHaveBeenCalled();
  });

});

describe('verifyJwtToken — Token expirado', () => {

  test('VT-05 | Lanza flaverr con code E_AUTH_TOKEN_EXPIRED', async () => {
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => { throw expiredError; });

    await expect(verifyToken('expired.token'))
      .rejects.toMatchObject({ code: 'E_AUTH_TOKEN_EXPIRED' });
  });

  test('VT-06 | El error de token expirado lleva name = "expired"', async () => {
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => { throw expiredError; });

    await expect(verifyToken('expired.token'))
      .rejects.toMatchObject({ name: 'expired' });
  });

  test('VT-07 | Registra el error en sails.log.error', async () => {
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => { throw expiredError; });

    await expect(verifyToken('expired.token')).rejects.toBeDefined();
    expect(sails.log.error).toHaveBeenCalledTimes(1);
  });

});

describe('verifyJwtToken — Token inválido o malformado', () => {

  test('VT-08 | Token con firma inválida - lanza E_AUTH_BAD_TOKEN', async () => {
    const err = new Error('invalid signature');
    err.name = 'JsonWebTokenError';
    jwt.verify.mockImplementation(() => { throw err; });
    await expect(verifyToken('bad.signature.token')).rejects.toMatchObject({ code: 'E_AUTH_BAD_TOKEN' });
  });

  test('VT-09 | Token malformado - lanza E_AUTH_BAD_TOKEN', async () => {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';
    jwt.verify.mockImplementation(() => { throw err; });
    await expect(verifyToken('not-a-jwt')).rejects.toMatchObject({ code: 'E_AUTH_BAD_TOKEN' });
  });

  test('VT-10 | Token vacío "" - lanza E_AUTH_BAD_TOKEN', async () => {
    const err = new Error('jwt must be provided');
    err.name = 'JsonWebTokenError';
    jwt.verify.mockImplementation(() => { throw err; });
    await expect(verifyToken('')).rejects.toMatchObject({ code: 'E_AUTH_BAD_TOKEN' });
  });

  test('VT-11 | El error inválido lleva name = "badToken"', async () => {
    const err = new Error('invalid');
    err.name = 'JsonWebTokenError';
    jwt.verify.mockImplementation(() => { throw err; });
    await expect(verifyToken('bad')).rejects.toMatchObject({ name: 'badToken' });
  });

  test('VT-12 | Cualquier otro error también lanza E_AUTH_BAD_TOKEN', async () => {
    jwt.verify.mockImplementation(() => { throw new Error('unexpected'); });
    await expect(verifyToken('tok')).rejects.toMatchObject({ code: 'E_AUTH_BAD_TOKEN' });
  });

});
