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
