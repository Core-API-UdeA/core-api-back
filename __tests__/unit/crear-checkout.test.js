'use strict';

/**
 * __tests__/unit/crear-checkout.test.js
 *
 * Tests del helper api/helpers/pagos/crear-checkout.js
 */

global.sails = {
  log: {
    verbose: jest.fn(),
    error: jest.fn(),
  },
  config: {
    platformFeePercentage: 10, // 10% de comisión
  },
  helpers: {
    pagos: {
      mercadopago: {
        crearCheckout: jest.fn(),
      },
    },
  },
};

global.Api = {
  getDatastore: jest.fn(() => ({
    transaction: async (cb) => cb('mock-db'),
  })),
  findOne: jest.fn(),
};

global.ApiSubscription = {
  findOne: jest.fn(),
};

global.ApiPlan = {
  findOne: jest.fn(),
};

global.ApiTransaction = {
  create: jest.fn(),
  updateOne: jest.fn(),
};

const helper = require('../../api/helpers/pagos/crear-checkout');

// ─── Helpers de tests ─────────────────────────────────────────────────────────

function defaultInputs(overrides = {}) {
  return {
    userId: 'user-1',
    apiId: 'api-1',
    planId: 'plan-1',
    paymentProvider: 'mercadopago',
    successUrl: 'https://test.com/success',
    cancelUrl: 'https://test.com/cancel',
    ...overrides,
  };
}

function buildPlan(overrides = {}) {
  return {
    id: 'plan-1',
    api_id: 'api-1',
    is_active: true,
    name: 'Plan Pro',
    price: 19.99,
    ...overrides,
  };
}

function buildApi(overrides = {}) {
  return {
    id: 'api-1',
    title: 'Test API',
    owner_id: {
      id: 'owner-1',
      email: 'owner@test.com',
    },
    ...overrides,
  };
}

function buildTransaction(overrides = {}) {
  return {
    id: 'trx-1',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

/**
 * Encadena .usingConnection sobre un mock.
 */
function withUsingConnection(returnValue) {
  return {
    usingConnection: jest.fn().mockResolvedValue(returnValue),
  };
}

/**
 * Configura Api.findOne con .populate().usingConnection() encadenado.
 */
function mockApiFindOnePopulate(returnValue) {
  Api.findOne.mockReturnValue({
    populate: jest.fn(() => withUsingConnection(returnValue)),
  });
}

/**
 * Configura el happy path completo.
 * Nota: usar `=== undefined` para distinguir entre "no provisto" y "provisto como null".
 */
function setupHappyPath({ subscription, plan, api, transaction } = {}) {
  ApiSubscription.findOne.mockReturnValue(
    withUsingConnection(subscription === undefined ? null : subscription)
  );
  ApiPlan.findOne.mockReturnValue(
    withUsingConnection(plan === undefined ? buildPlan() : plan)
  );
  mockApiFindOnePopulate(api === undefined ? buildApi() : api);

  ApiTransaction.create.mockReturnValue({
    fetch: jest.fn(() =>
      withUsingConnection(transaction === undefined ? buildTransaction() : transaction)
    ),
  });

  ApiTransaction.updateOne.mockReturnValue({
    set: jest.fn(() => withUsingConnection(true)),
  });

  sails.helpers.pagos.mercadopago.crearCheckout.mockResolvedValue(
    'https://mercadopago.com/checkout/abc123'
  );
}

beforeEach(() => {
  jest.clearAllMocks();

  Api.getDatastore.mockReturnValue({
    transaction: async (cb) => cb('mock-db'),
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('crearCheckout — Validación de suscripción existente', () => {

  test('CCH-01 | Usuario ya suscrito → lanza alreadySubscribed', async () => {
    setupHappyPath({
      subscription: { id: 'sub-existing' },
    });

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toMatchObject({ code: 'alreadySubscribed' });
  });

  test('CCH-02 | alreadySubscribed NO se envuelve en E_CREAR_CHECKOUT', async () => {
    setupHappyPath({
      subscription: { id: 'sub-existing' },
    });

    try {
      await helper.fn(defaultInputs());
      throw new Error('debería haber lanzado');
    } catch (error) {
      expect(error.code).toBe('alreadySubscribed');
    }
  });

  test('CCH-03 | Si ya está suscrito, NO crea transacción', async () => {
    setupHappyPath({
      subscription: { id: 'sub-existing' },
    });

    await expect(helper.fn(defaultInputs())).rejects.toThrow();

    expect(ApiTransaction.create).not.toHaveBeenCalled();
  });

});

describe('crearCheckout — Validación de plan', () => {

  test('CCH-04 | Plan no encontrado → lanza invalidPlan', async () => {
    setupHappyPath({ plan: null });

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toMatchObject({ code: 'invalidPlan' });
  });

  test('CCH-05 | Plan inactivo → no encuentra y lanza invalidPlan', async () => {
    // ApiPlan.findOne con is_active: true no devuelve nada si está inactivo
    setupHappyPath({ plan: null });

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toMatchObject({ code: 'invalidPlan' });
  });

  test('CCH-06 | Plan con price=0 → lanza freePlan', async () => {
    setupHappyPath({
      plan: buildPlan({ price: 0 }),
    });

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toThrow(/gratuito/);
  });

  test('CCH-07 | Plan con price="0" (string) → también lanza freePlan', async () => {
    setupHappyPath({
      plan: buildPlan({ price: '0' }),
    });

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toThrow(/gratuito/);
  });

});

describe('crearCheckout — Happy path con MercadoPago', () => {

  test('CCH-08 | Retorna success=true con checkout_url y transaction_id', async () => {
    setupHappyPath();

    const result = await helper.fn(defaultInputs());

    expect(result.success).toBe(true);
    expect(result.transaction_id).toBe('trx-1');
    expect(result.checkout_url).toContain('mercadopago.com');
    expect(result.message).toBe('Checkout creado exitosamente');
  });

  test('CCH-09 | Crea ApiTransaction con monto y comisión correctos', async () => {
    setupHappyPath({
      plan: buildPlan({ price: 100 }),
    });

    await helper.fn(defaultInputs());

    expect(ApiTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        api_id: 'api-1',
        plan_id: 'plan-1',
        amount: 100,
        platform_fee: 10,    // 10% de 100
        owner_payout: 90,    // 100 - 10
        payment_status: 'pending',
        payment_provider: 'mercadopago',
      })
    );
  });

  test('CCH-10 | La transacción se crea con expires_at en 24h', async () => {
    setupHappyPath();

    await helper.fn(defaultInputs());

    const createCall = ApiTransaction.create.mock.calls[0][0];
    const ahora = Date.now();
    const veinticuatroHoras = 24 * 60 * 60 * 1000;
    const diff = createCall.expires_at.getTime() - ahora;

    // Debe estar cerca de 24 horas (con margen de 1 segundo)
    expect(diff).toBeGreaterThan(veinticuatroHoras - 1000);
    expect(diff).toBeLessThan(veinticuatroHoras + 1000);
  });

  test('CCH-11 | Llama al helper de mercadopago con transaction, plan y api', async () => {
    const plan = buildPlan({ price: 50 });
    const api = buildApi();
    const transaction = buildTransaction();

    setupHappyPath({ plan, api, transaction });

    await helper.fn(defaultInputs());

    expect(sails.helpers.pagos.mercadopago.crearCheckout).toHaveBeenCalledWith(
      transaction,
      plan,
      api
    );
  });

  test('CCH-12 | Actualiza la transacción con checkout_url y status=processing', async () => {
    setupHappyPath();

    const setMock = jest.fn(() => withUsingConnection(true));
    ApiTransaction.updateOne.mockReturnValue({ set: setMock });

    await helper.fn(defaultInputs());

    // El id de la transacción es generado con uuidv4, no podemos predecirlo.
    // Verificamos que updateOne fue llamado con un objeto que tiene un id (UUID).
    expect(ApiTransaction.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
      })
    );
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        checkout_url: expect.stringContaining('mercadopago.com'),
        payment_status: 'processing',
      })
    );
  });

  test('CCH-13 | metadata incluye api_title, plan_name, owner_id, owner_email', async () => {
    setupHappyPath({
      plan: buildPlan({ name: 'Plan Premium' }),
      api: buildApi({
        title: 'Mi API Genial',
        owner_id: { id: 'owner-99', email: 'jose@test.com' },
      }),
    });

    await helper.fn(defaultInputs());

    const createCall = ApiTransaction.create.mock.calls[0][0];
    expect(createCall.metadata).toEqual({
      api_title: 'Mi API Genial',
      plan_name: 'Plan Premium',
      owner_id: 'owner-99',
      owner_email: 'jose@test.com',
    });
  });

});

describe('crearCheckout — Validación de la API', () => {

  test('CCH-14 | API no encontrada → lanza error envuelto en E_CREAR_CHECKOUT', async () => {
    ApiSubscription.findOne.mockReturnValue(withUsingConnection(null));
    ApiPlan.findOne.mockReturnValue(withUsingConnection(buildPlan()));
    mockApiFindOnePopulate(null);

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toMatchObject({ code: 'E_CREAR_CHECKOUT' });
  });

});

describe('crearCheckout — Stripe y PayPal (sin implementación)', () => {

  test('CCH-15 | paymentProvider=stripe → no llama mercadopago helper', async () => {
    setupHappyPath();

    await helper.fn(defaultInputs({ paymentProvider: 'stripe' }));

    expect(sails.helpers.pagos.mercadopago.crearCheckout).not.toHaveBeenCalled();
  });

  test('CCH-16 | paymentProvider=paypal → no llama mercadopago helper', async () => {
    setupHappyPath();

    await helper.fn(defaultInputs({ paymentProvider: 'paypal' }));

    expect(sails.helpers.pagos.mercadopago.crearCheckout).not.toHaveBeenCalled();
  });

});

describe('crearCheckout — Manejo de errores', () => {

  test('CCH-17 | Error en BD → lanza E_CREAR_CHECKOUT', async () => {
    Api.getDatastore.mockReturnValue({
      transaction: jest.fn().mockRejectedValue(new Error('DB exploded')),
    });

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toMatchObject({ code: 'E_CREAR_CHECKOUT' });
  });

  test('CCH-18 | invalidPlan se propaga sin envolverse', async () => {
    setupHappyPath({ plan: null });

    try {
      await helper.fn(defaultInputs());
      throw new Error('debería haber lanzado');
    } catch (error) {
      expect(error.code).toBe('invalidPlan');
      expect(error.code).not.toBe('E_CREAR_CHECKOUT');
    }
  });

  test('CCH-19 | En cualquier error registra sails.log.error', async () => {
    Api.getDatastore.mockReturnValue({
      transaction: jest.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(helper.fn(defaultInputs())).rejects.toThrow();

    expect(sails.log.error).toHaveBeenCalled();
  });

  test('CCH-20 | Si crearCheckout de mercadopago falla → envuelve en E_CREAR_CHECKOUT', async () => {
    setupHappyPath();
    sails.helpers.pagos.mercadopago.crearCheckout.mockRejectedValue(
      new Error('MP API down')
    );

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toMatchObject({ code: 'E_CREAR_CHECKOUT' });
  });

});
