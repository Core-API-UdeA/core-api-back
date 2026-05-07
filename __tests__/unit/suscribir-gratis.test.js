'use strict';

/**
 * __tests__/unit/suscribir-gratis.test.js
 *
 * Cobertura del helper api/helpers/pagos/suscribir-gratis.js
 */

const proxyquire = require('proxyquire').noCallThru();

// ─── Helpers de construcción de mocks ────────────────────────────────────────

function makeFetch(resolvedValue) {
  const fetch         = jest.fn().mockResolvedValue(resolvedValue);
  const usingConn     = jest.fn().mockReturnValue({ fetch });
  const create        = jest.fn().mockReturnValue({ fetch: () => usingConn(), usingConnection: usingConn });
  return { create, usingConn, fetch };
}

function makeUsingConn(resolvedValue) {
  return jest.fn().mockResolvedValue(resolvedValue);
}

function buildGlobals({
  existingSubscription = null,
  plan                 = { id: 'plan-1', api_id: 'api-1', is_active: true, price: 0, name: 'Free' },
  api                  = { id: 'api-1', title: 'Mi API' },
  createdSubscription  = { id: 'sub-new' },
  transactionFail      = false,
  transactionThrows    = false,
} = {}) {

  const createSubMock = jest.fn().mockReturnValue({
    fetch: jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(createdSubscription),
    }),
    usingConnection: jest.fn().mockResolvedValue(createdSubscription),
  });

  const createTxMock = jest.fn().mockReturnValue({
    usingConnection: jest.fn().mockResolvedValue({ id: 'tx-1' }),
  });

  global.ApiSubscription = {
    findOne: jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(existingSubscription),
    }),
    create: createSubMock,
  };

  global.ApiPlan = {
    findOne: jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(plan),
    }),
  };

  global.Api = {
    findOne: jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(api),
    }),
    getDatastore: jest.fn().mockReturnValue({
      transaction: jest.fn().mockImplementation(async (cb) => {
        if (transactionThrows) throw new Error('DB error');
        return cb('mock-db');
      }),
    }),
  };

  global.ApiTransaction = {
    create: createTxMock,
  };
}

global.sails = {
  log: {
    verbose: jest.fn(),
    error:   jest.fn(),
  },
};

const helper = proxyquire('../../api/helpers/pagos/suscribir-gratis', {
  uuid:    { v4: () => 'mock-uuid' },
  flaverr: require('flaverr'),
});

async function suscribir(args = {}) {
  return helper.fn({
    userId: 'user-1',
    apiId:  'api-1',
    planId: 'plan-1',
    ...args,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  buildGlobals();
});

// ─── Happy Path ───────────────────────────────────────────────────────────────

describe('suscribirGratis — Happy Path', () => {

  test('SG-01 | Retorna objeto con subscription_id, plan_name, api_name, status y start_date', async () => {
    const resultado = await suscribir();
    expect(resultado).toMatchObject({
      subscription_id: expect.any(String),
      plan_name:       'Free',
      api_name:        'Mi API',
      status:          'active',
      start_date:      expect.any(Date),
    });
  });

  test('SG-02 | Llama ApiSubscription.create una vez', async () => {
    await suscribir();
    expect(global.ApiSubscription.create).toHaveBeenCalledTimes(1);
  });

  test('SG-03 | Llama ApiTransaction.create una vez', async () => {
    await suscribir();
    expect(global.ApiTransaction.create).toHaveBeenCalledTimes(1);
  });

  test('SG-04 | La suscripción se crea con status "active"', async () => {
    await suscribir();
    const callArgs = global.ApiSubscription.create.mock.calls[0][0];
    expect(callArgs.status).toBe('active');
  });

  test('SG-05 | La transacción se crea con amount = 0 y payment_status "completed"', async () => {
    await suscribir();
    const callArgs = global.ApiTransaction.create.mock.calls[0][0];
    expect(callArgs.amount).toBe(0);
    expect(callArgs.payment_status).toBe('completed');
  });

  test('SG-06 | Logs verbose se llaman durante la ejecución exitosa', async () => {
    await suscribir();
    expect(sails.log.verbose).toHaveBeenCalled();
  });

  test('SG-07 | Plan con price como string "0" también es aceptado', async () => {
    buildGlobals({ plan: { id: 'plan-1', api_id: 'api-1', is_active: true, price: '0', name: 'Free' } });
    const resultado = await suscribir();
    expect(resultado.status).toBe('active');
  });

});

// ─── Error: ya suscrito ───────────────────────────────────────────────────────

describe('suscribirGratis — Ya suscrito', () => {

  test('SG-08 | Lanza error con code "alreadySubscribed" si ya existe suscripción activa', async () => {
    buildGlobals({ existingSubscription: { id: 'sub-exist', status: 'active' } });
    await expect(suscribir()).rejects.toMatchObject({ code: 'alreadySubscribed' });
  });

  test('SG-09 | No crea suscripción si ya existe una activa', async () => {
    buildGlobals({ existingSubscription: { id: 'sub-exist', status: 'active' } });
    await expect(suscribir()).rejects.toBeDefined();
    expect(global.ApiSubscription.create).not.toHaveBeenCalled();
  });

});

// ─── Error: plan inválido ─────────────────────────────────────────────────────

describe('suscribirGratis — Plan inválido', () => {

  test('SG-10 | Lanza "invalidPlan" si el plan no existe', async () => {
    buildGlobals({ plan: null });
    await expect(suscribir()).rejects.toMatchObject({ code: 'invalidPlan' });
  });

  test('SG-11 | No crea suscripción si el plan no existe', async () => {
    buildGlobals({ plan: null });
    await expect(suscribir()).rejects.toBeDefined();
    expect(global.ApiSubscription.create).not.toHaveBeenCalled();
  });

});

// ─── Error: plan de pago ──────────────────────────────────────────────────────

describe('suscribirGratis — Plan de pago (no gratuito)', () => {

  test('SG-12 | Lanza "notFree" si el plan tiene price > 0', async () => {
    buildGlobals({ plan: { id: 'plan-1', api_id: 'api-1', is_active: true, price: 9.99, name: 'Pro' } });
    await expect(suscribir()).rejects.toMatchObject({ code: 'notFree' });
  });

  test('SG-13 | Lanza "notFree" si el plan tiene price como string "9.99"', async () => {
    buildGlobals({ plan: { id: 'plan-1', api_id: 'api-1', is_active: true, price: '9.99', name: 'Pro' } });
    await expect(suscribir()).rejects.toMatchObject({ code: 'notFree' });
  });

  test('SG-14 | No crea suscripción si el plan tiene costo', async () => {
    buildGlobals({ plan: { id: 'plan-1', api_id: 'api-1', is_active: true, price: 5, name: 'Basic' } });
    await expect(suscribir()).rejects.toBeDefined();
    expect(global.ApiSubscription.create).not.toHaveBeenCalled();
  });

});

// ─── Error: DB falla ──────────────────────────────────────────────────────────

describe('suscribirGratis — Fallo de base de datos', () => {

  test('SG-15 | Si la transacción de BD falla, lanza E_SUSCRIBIR_GRATIS', async () => {
    buildGlobals({ transactionThrows: true });
    await expect(suscribir()).rejects.toMatchObject({ code: 'E_SUSCRIBIR_GRATIS' });
  });

  test('SG-16 | Se registra el error en sails.log.error cuando la BD falla', async () => {
    buildGlobals({ transactionThrows: true });
    await expect(suscribir()).rejects.toBeDefined();
    expect(sails.log.error).toHaveBeenCalledTimes(1);
  });

});

// ─── Error: API no encontrada ─────────────────────────────────────────────────

describe('suscribirGratis — API no encontrada', () => {

  test('SG-17 | Si la API no existe, lanza E_SUSCRIBIR_GRATIS', async () => {
    buildGlobals({ api: null });
    await expect(suscribir()).rejects.toMatchObject({ code: 'E_SUSCRIBIR_GRATIS' });
  });

});
