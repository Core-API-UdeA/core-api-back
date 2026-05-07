'use strict';

jest.mock('mercadopago', () => {

  return {
    MercadoPagoConfig: jest.fn(),

    Payment: jest.fn(() => ({
      get: jest.fn(),
    })),

    MerchantOrder: jest.fn(() => ({
      get: jest.fn(),
    })),
  };

});

global.sails = {
  log: {
    verbose: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },

  config: {
    mercadoPagoAccessToken: 'TEST-123',
    environment: 'development',
  },
};

const helper = require('../../api/helpers/pagos/mercadopago/procesar-webhook');

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('procesar-webhook.js', () => {

  test('PW-01 | Procesa webhook tipo payment', async () => {

    const spy = jest
      .spyOn(helper._private, 'procesarPago')
      .mockResolvedValue(true);

    const result = await helper.fn({
      type: 'payment',
      data: {
        id: 123,
      },
    });

    expect(spy).toHaveBeenCalled();

    expect(result).toEqual({
      success: true,
    });
  });

  test('PW-02 | Procesa webhook tipo merchant_order', async () => {

    const spy = jest
      .spyOn(helper._private, 'procesarOrden')
      .mockResolvedValue(true);

    const result = await helper.fn({
      type: 'merchant_order',
      data: {
        id: 999,
      },
    });

    expect(spy).toHaveBeenCalled();

    expect(result).toEqual({
      success: true,
    });
  });

  test('PW-03 | Ignora tipos no manejados', async () => {

    const result = await helper.fn({
      type: 'unknown_type',
      data: {
        id: 1,
      },
    });

    expect(result).toEqual({
      success: true,
    });

    expect(sails.log.verbose).toHaveBeenCalled();
  });

  test('PW-04 | Maneja errores 404 como ignored', async () => {

    jest
      .spyOn(helper._private, 'procesarPago')
      .mockRejectedValue({
        status: 404,
      });

    const result = await helper.fn({
      type: 'payment',
      data: {
        id: 123,
      },
    });

    expect(result).toEqual({
      success: true,
      ignored: true,
    });

    expect(sails.log.warn).toHaveBeenCalled();
  });

  test('PW-05 | Maneja error not_found', async () => {

    jest
      .spyOn(helper._private, 'procesarPago')
      .mockRejectedValue({
        error: 'not_found',
      });

    const result = await helper.fn({
      type: 'payment',
      data: {
        id: 123,
      },
    });

    expect(result).toEqual({
      success: true,
      ignored: true,
    });
  });

  test('PW-06 | Relanza errores generales', async () => {

    jest
      .spyOn(helper._private, 'procesarPago')
      .mockRejectedValue(
        new Error('MercadoPago explotó')
      );

    await expect(
      helper.fn({
        type: 'payment',
        data: {
          id: 123,
        },
      })
    ).rejects.toThrow('MercadoPago explotó');

  });

});

describe('procesarPagoConInfo', () => {

  beforeEach(() => {

    global.Api = {
      getDatastore: jest.fn(() => ({
        transaction: async (cb) => cb('mock-db'),
      })),
    };

    global.ApiTransaction = {
      findOne: jest.fn(),
      updateOne: jest.fn(() => ({
        set: jest.fn(() => ({
          usingConnection: jest.fn().mockResolvedValue(true),
        })),
      })),
    };

    global.ApiSubscription = {
      findOne: jest.fn(),
      create: jest.fn(() => ({
        fetch: jest.fn(() => ({
          usingConnection: jest.fn(),
        })),
      })),
    };

    global.ApiPlan = {
      findOne: jest.fn(),
    };

  });

  test('PW-07 | Ignora pagos sin external_reference', async () => {

    await helper._private.procesarPagoConInfo({
      id: 100,
      status: 'approved',
    });

    expect(sails.log.warn).toHaveBeenCalled();
  });

  test('PW-08 | Ignora transacción inexistente', async () => {

    ApiTransaction.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(null),
    });

    await helper._private.procesarPagoConInfo({
      id: 100,
      status: 'approved',
      external_reference: 'trx-1',
    });

    expect(sails.log.error).toHaveBeenCalled();
  });

  test('PW-09 | Ignora webhook duplicado', async () => {

    ApiTransaction.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        id: 'trx-1',
        payment_status: 'completed',
        subscription_id: 'sub-1',
      }),
    });

    await helper._private.procesarPagoConInfo({
      id: 100,
      status: 'approved',
      external_reference: 'trx-1',
    });

    expect(sails.log.verbose).toHaveBeenCalled();
  });

  test('PW-10 | Marca approved como completed', async () => {

    ApiTransaction.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        id: 'trx-1',
        payment_status: 'pending',
        payment_metadata: {},
      }),
    });

    const setMock = jest.fn(() => ({
      usingConnection: jest.fn().mockResolvedValue(true),
    }));

    ApiTransaction.updateOne.mockReturnValue({
      set: setMock,
    });

    jest
      .spyOn(helper._private, 'crearSuscripcionDesdePago')
      .mockResolvedValue(true);

    await helper._private.procesarPagoConInfo({
      id: 200,
      status: 'approved',
      status_detail: 'accredited',
      external_reference: 'trx-1',
    });

    expect(ApiTransaction.updateOne).toHaveBeenCalled();

    const payload = setMock.mock.calls[0][0];

    expect(payload.payment_status).toBe('completed');
  });

  test('PW-11 | Marca pending como processing', async () => {

    ApiTransaction.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        id: 'trx-2',
        payment_status: 'pending',
        payment_metadata: {},
      }),
    });

    const setMock = jest.fn(() => ({
      usingConnection: jest.fn().mockResolvedValue(true),
    }));

    ApiTransaction.updateOne.mockReturnValue({
      set: setMock,
    });

    await helper._private.procesarPagoConInfo({
      id: 201,
      status: 'pending',
      external_reference: 'trx-2',
    });

    const payload = setMock.mock.calls[0][0];

    expect(payload.payment_status).toBe('processing');
  });

  test('PW-12 | Marca rejected como failed', async () => {

    ApiTransaction.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        id: 'trx-3',
        payment_status: 'pending',
        payment_metadata: {},
      }),
    });

    const setMock = jest.fn(() => ({
      usingConnection: jest.fn().mockResolvedValue(true),
    }));

    ApiTransaction.updateOne.mockReturnValue({
      set: setMock,
    });

    await helper._private.procesarPagoConInfo({
      id: 202,
      status: 'rejected',
      status_detail: 'cc_rejected',
      external_reference: 'trx-3',
    });

    const payload = setMock.mock.calls[0][0];

    expect(payload.payment_status).toBe('failed');
  });

  test('PW-13 | Marca refunded correctamente', async () => {

    ApiTransaction.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        id: 'trx-4',
        payment_status: 'completed',
        payment_metadata: {},
      }),
    });

    const setMock = jest.fn(() => ({
      usingConnection: jest.fn().mockResolvedValue(true),
    }));

    ApiTransaction.updateOne.mockReturnValue({
      set: setMock,
    });

    await helper._private.procesarPagoConInfo({
      id: 203,
      status: 'refunded',
      external_reference: 'trx-4',
    });

    const payload = setMock.mock.calls[0][0];

    expect(payload.payment_status).toBe('refunded');
    expect(payload.refunded_at).toBeDefined();
  });

  test('PW-14 | Maneja estados desconocidos', async () => {

    ApiTransaction.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        id: 'trx-5',
        payment_status: 'pending',
        payment_metadata: {},
      }),
    });

    ApiTransaction.updateOne.mockReturnValue({
      set: jest.fn(() => ({
        usingConnection: jest.fn().mockResolvedValue(true),
      })),
    });

    await helper._private.procesarPagoConInfo({
      id: 204,
      status: 'estado_raro',
      external_reference: 'trx-5',
    });

    expect(sails.log.warn).toHaveBeenCalled();
  });

});

describe('crearSuscripcionDesdePago', () => {

  beforeEach(() => {

    global.ApiPlan = {
      findOne: jest.fn(),
    };

    global.ApiSubscription = {
      findOne: jest.fn(),
      create: jest.fn(),
    };

    global.ApiTransaction = {
      updateOne: jest.fn(() => ({
        set: jest.fn(() => ({
          usingConnection: jest.fn().mockResolvedValue(true),
        })),
      })),
    };

  });

  test('PW-15 | Lanza error si el plan no existe', async () => {

    ApiPlan.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(null),
    });

    await expect(
      helper._private.crearSuscripcionDesdePago(
        {
          id: 'trx-1',
          plan_id: 'plan-x',
        },
        'mock-db'
      )
    ).rejects.toThrow('Plan no encontrado');

  });

  test('PW-16 | Reutiliza suscripción existente', async () => {

    ApiPlan.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        billing_cycle: 'monthly',
      }),
    });

    ApiSubscription.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        id: 'sub-existing',
      }),
    });

    const result = await helper._private.crearSuscripcionDesdePago(
      {
        id: 'trx-2',
        user_id: 'user-1',
        api_id: 'api-1',
        plan_id: 'plan-1',
      },
      'mock-db'
    );

    expect(ApiTransaction.updateOne).toHaveBeenCalled();

    expect(result).toEqual({
      id: 'sub-existing',
    });
  });

  test('PW-17 | Crea suscripción monthly', async () => {

    ApiPlan.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        billing_cycle: 'monthly',
      }),
    });

    ApiSubscription.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(null),
    });

    const fetchMock = jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        id: 'sub-monthly',
      }),
    });

    ApiSubscription.create.mockReturnValue({
      fetch: fetchMock,
    });

    const result = await helper._private.crearSuscripcionDesdePago(
      {
        id: 'trx-3',
        user_id: 'user-1',
        api_id: 'api-1',
        plan_id: 'plan-1',
      },
      'mock-db'
    );

    expect(ApiSubscription.create).toHaveBeenCalled();

    expect(result).toEqual({
      id: 'sub-monthly',
    });
  });

  test('PW-18 | Crea suscripción yearly', async () => {

    ApiPlan.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        billing_cycle: 'yearly',
      }),
    });

    ApiSubscription.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(null),
    });

    ApiSubscription.create.mockReturnValue({
      fetch: jest.fn(() => ({
        usingConnection: jest.fn().mockResolvedValue({
          id: 'sub-yearly',
        }),
      })),
    });

    const result = await helper._private.crearSuscripcionDesdePago(
      {
        id: 'trx-4',
        user_id: 'user-2',
        api_id: 'api-2',
        plan_id: 'plan-2',
      },
      'mock-db'
    );

    expect(result.id).toBe('sub-yearly');
  });

  test('PW-19 | Crea suscripción lifetime', async () => {

    ApiPlan.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        billing_cycle: 'lifetime',
      }),
    });

    ApiSubscription.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(null),
    });

    ApiSubscription.create.mockReturnValue({
      fetch: jest.fn(() => ({
        usingConnection: jest.fn().mockResolvedValue({
          id: 'sub-life',
        }),
      })),
    });

    const result = await helper._private.crearSuscripcionDesdePago(
      {
        id: 'trx-5',
        user_id: 'user-3',
        api_id: 'api-3',
        plan_id: 'plan-3',
      },
      'mock-db'
    );

    expect(result.id).toBe('sub-life');
  });

  test('PW-20 | Crea suscripción pay_per_use', async () => {

    ApiPlan.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        billing_cycle: 'pay_per_use',
      }),
    });

    ApiSubscription.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(null),
    });

    ApiSubscription.create.mockReturnValue({
      fetch: jest.fn(() => ({
        usingConnection: jest.fn().mockResolvedValue({
          id: 'sub-ppu',
        }),
      })),
    });

    const result = await helper._private.crearSuscripcionDesdePago(
      {
        id: 'trx-6',
        user_id: 'user-4',
        api_id: 'api-4',
        plan_id: 'plan-4',
      },
      'mock-db'
    );

    expect(result.id).toBe('sub-ppu');
  });

  test('PW-21 | Usa monthly por defecto en billing_cycle desconocido', async () => {

    ApiPlan.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({
        billing_cycle: 'random_mode',
      }),
    });

    ApiSubscription.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(null),
    });

    ApiSubscription.create.mockReturnValue({
      fetch: jest.fn(() => ({
        usingConnection: jest.fn().mockResolvedValue({
          id: 'sub-default',
        }),
      })),
    });

    await helper._private.crearSuscripcionDesdePago(
      {
        id: 'trx-7',
        user_id: 'user-5',
        api_id: 'api-5',
        plan_id: 'plan-5',
      },
      'mock-db'
    );

    expect(sails.log.warn).toHaveBeenCalled();
  });

  test('PW-22 | Maneja errores internos', async () => {

    ApiPlan.findOne.mockImplementation(() => {
      throw new Error('DB exploded');
    });

    await expect(
      helper._private.crearSuscripcionDesdePago(
        {
          id: 'trx-8',
          plan_id: 'plan-8',
        },
        'mock-db'
      )
    ).rejects.toThrow('DB exploded');

    expect(sails.log.error).toHaveBeenCalled();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Tests adicionales para subir cobertura de procesar-webhook.js
// Cubren: procesarPago (con reintentos), procesarPagoSandboxFallback, procesarOrden
// ─────────────────────────────────────────────────────────────────────────────

describe('procesarPago — Reintentos y rutas alternativas', () => {

  // Mock dinámico de Payment para controlar payment.get() en cada test
  let getMock;

  beforeEach(() => {
    jest.useFakeTimers();

    getMock = jest.fn();

    const mp = require('mercadopago');
    mp.Payment.mockImplementation(() => ({ get: getMock }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('PW-23 | Happy path: payment.get retorna info → llama procesarPagoConInfo', async () => {

    getMock.mockResolvedValue({
      id: 1234,
      status: 'approved',
      external_reference: 'trx-1',
    });

    const spy = jest
      .spyOn(helper._private, 'procesarPagoConInfo')
      .mockResolvedValue(true);

    await helper._private.procesarPago({}, 1234, false);

    expect(getMock).toHaveBeenCalledWith({ id: 1234 });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1234, status: 'approved' })
    );
  });

  test('PW-24 | Si paymentInfo es undefined después del loop → log.warn y return', async () => {

    // Simular que payment.get nunca lanza pero retorna undefined.
    // Esto rompe el while porque entra al try, asigna undefined, hace break.
    getMock.mockResolvedValue(undefined);

    const spy = jest
      .spyOn(helper._private, 'procesarPagoConInfo')
      .mockResolvedValue(true);

    await helper._private.procesarPago({}, 1234, false);

    expect(sails.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo obtener información')
    );
    expect(spy).not.toHaveBeenCalled();
  });

  test('PW-25 | 404 con reintentos: falla 1 vez, encuentra en intento 2', async () => {

    getMock
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({
        id: 5555,
        status: 'approved',
        external_reference: 'trx-x',
      });

    jest.spyOn(helper._private, 'procesarPagoConInfo').mockResolvedValue(true);

    const promise = helper._private.procesarPago({}, 5555, false);

    // Avanzar el timer del retryDelay (5000ms en no-sandbox)
    await jest.advanceTimersByTimeAsync(5000);

    await promise;

    expect(getMock).toHaveBeenCalledTimes(2);
    expect(sails.log.verbose).toHaveBeenCalledWith(
      expect.stringContaining('reintento 1/3')
    );
  });

  test('PW-26 | Sandbox: falla todos los intentos con 404 → llama procesarPagoSandboxFallback', async () => {

    getMock.mockRejectedValue({ status: 404 });

    const fallbackSpy = jest
      .spyOn(helper._private, 'procesarPagoSandboxFallback')
      .mockResolvedValue('fallback-result');

    const promise = helper._private.procesarPago({}, 9999, true);

    // En sandbox: 5 intentos x 8000ms = 40 segundos
    // Avanzar el tiempo total (suficiente para todos los reintentos)
    for (let i = 0; i < 5; i++) {
      await jest.advanceTimersByTimeAsync(8000);
    }

    const result = await promise;

    expect(result).toBe('fallback-result');
    expect(fallbackSpy).toHaveBeenCalledWith(9999);
    expect(sails.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('sandbox')
    );
  });

  test('PW-27 | No-sandbox: falla todos los intentos con 404 → throw', async () => {

    getMock.mockRejectedValue({ status: 404 });

    const promise = helper._private.procesarPago({}, 7777, false);

    // IMPORTANTE: adjuntar el assertion de rejection ANTES de avanzar timers
    // para que Jest sepa que la rejection será manejada (evita unhandled rejection).
    const expectation = expect(promise).rejects.toMatchObject({ status: 404 });

    // No-sandbox: 3 intentos x 5000ms
    for (let i = 0; i < 3; i++) {
      await jest.advanceTimersByTimeAsync(5000);
    }

    await expectation;

    expect(sails.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('no encontrado después de 3 intentos')
    );
  });

  test('PW-28 | Otro tipo de error (no 404) → relanza inmediatamente', async () => {

    getMock.mockRejectedValue(new Error('Network down'));

    await expect(
      helper._private.procesarPago({}, 8888, false)
    ).rejects.toThrow('Network down');

    // No debería haberse hecho ningún reintento
    expect(getMock).toHaveBeenCalledTimes(1);
  });

});

describe('procesarPagoSandboxFallback', () => {

  beforeEach(() => {

    global.Api = {
      getDatastore: jest.fn(() => ({
        transaction: async (cb) => cb('mock-db'),
      })),
    };

    global.ApiTransaction = {
      find: jest.fn(),
      updateOne: jest.fn(() => ({
        set: jest.fn(() => ({
          usingConnection: jest.fn().mockResolvedValue(true),
        })),
      })),
    };
  });

  /**
   * Helper para construir el chain ApiTransaction.find().sort().limit().usingConnection()
   */
  function mockFindChain(returnValue) {
    ApiTransaction.find.mockReturnValue({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          usingConnection: jest.fn().mockResolvedValue(returnValue),
        })),
      })),
    });
  }

  test('PW-29 | Sin transacciones pendientes → log.warn y return', async () => {

    mockFindChain([]);

    await helper._private.procesarPagoSandboxFallback(123);

    expect(sails.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('No hay transacciones pendientes')
    );
    expect(ApiTransaction.updateOne).not.toHaveBeenCalled();
  });

  test('PW-30 | Con transacción pendiente y sin subscription_id → actualiza y crea suscripción', async () => {

    mockFindChain([
      {
        id: 'trx-pending-1',
        payment_metadata: { foo: 'bar' },
        subscription_id: null,
      },
    ]);

    const setMock = jest.fn(() => ({
      usingConnection: jest.fn().mockResolvedValue(true),
    }));
    ApiTransaction.updateOne.mockReturnValue({ set: setMock });

    const crearSpy = jest
      .spyOn(helper._private, 'crearSuscripcionDesdePago')
      .mockResolvedValue(true);

    await helper._private.procesarPagoSandboxFallback(456);

    expect(ApiTransaction.updateOne).toHaveBeenCalledWith({ id: 'trx-pending-1' });
    const payload = setMock.mock.calls[0][0];
    expect(payload.payment_status).toBe('completed');
    expect(payload.payment_metadata.sandbox_fallback).toBe(true);

    expect(crearSpy).toHaveBeenCalled();
  });

  test('PW-31 | Con transacción pendiente que YA tiene subscription_id → no crea suscripción', async () => {

    mockFindChain([
      {
        id: 'trx-pending-2',
        payment_metadata: {},
        subscription_id: 'sub-existing',
      },
    ]);

    const crearSpy = jest
      .spyOn(helper._private, 'crearSuscripcionDesdePago')
      .mockResolvedValue(true);

    await helper._private.procesarPagoSandboxFallback(789);

    expect(crearSpy).not.toHaveBeenCalled();
  });

  test('PW-32 | Error en BD durante fallback → relanza y registra log.error', async () => {

    Api.getDatastore.mockReturnValue({
      transaction: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    });

    await expect(
      helper._private.procesarPagoSandboxFallback(999)
    ).rejects.toThrow('DB connection lost');

    expect(sails.log.error).toHaveBeenCalledWith(
      expect.stringContaining('fallback de sandbox'),
      expect.any(Error)
    );
  });

});

describe('procesarOrden', () => {

  let getMock;

  beforeEach(() => {
    getMock = jest.fn();

    const mp = require('mercadopago');
    mp.MerchantOrder.mockImplementation(() => ({ get: getMock }));
  });

  test('PW-33 | Happy path: retorna info de la orden y registra log', async () => {

    getMock.mockResolvedValue({
      id: 'order-1',
      status: 'closed',
      external_reference: 'ext-ref-1',
    });

    await helper._private.procesarOrden({}, 'order-1', false);

    expect(getMock).toHaveBeenCalledWith({ merchantOrderId: 'order-1' });
    expect(sails.log.verbose).toHaveBeenCalledWith(
      'Información de la orden:',
      expect.objectContaining({ id: 'order-1' })
    );
  });

  test('PW-34 | Error 404 → log.warn y return (no relanza)', async () => {

    getMock.mockRejectedValue({ status: 404 });

    await expect(
      helper._private.procesarOrden({}, 'order-404', false)
    ).resolves.toBeUndefined();

    expect(sails.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('no encontrada en MP')
    );
  });

  test('PW-35 | Error not_found (variante alternativa) → log.warn y return', async () => {

    getMock.mockRejectedValue({ error: 'not_found' });

    await expect(
      helper._private.procesarOrden({}, 'order-nf', false)
    ).resolves.toBeUndefined();

    expect(sails.log.warn).toHaveBeenCalled();
  });

  test('PW-36 | Otro tipo de error → log.error y relanza', async () => {

    getMock.mockRejectedValue(new Error('Auth failed'));

    await expect(
      helper._private.procesarOrden({}, 'order-err', false)
    ).rejects.toThrow('Auth failed');

    expect(sails.log.error).toHaveBeenCalled();
  });

});
