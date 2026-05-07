'use strict';

/**
 * __tests__/unit/proxy-fn.test.js
 *
 * Tests del fn principal de api/controllers/gateway/proxy.js
 *
 * IMPORTANTE: Este archivo asume que en proxy.js se ha agregado
 * _hacerProxyRequest al módulo _private para poder mockearlo:
 *
 *   module.exports._private = {
 *     _construirUrlDestino,
 *     _construirHeaders,
 *     _actualizarMetrica,
 *     _hacerProxyRequest,   // ← debe estar exportada
 *   };
 *
 * Y la llamada dentro del fn debe ser:
 *   await module.exports._private._hacerProxyRequest({ ... });
 */

global.sails = {
  log: {
    verbose: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  helpers: {
    gateway: {
      cifrarCredenciales: {
        with: jest.fn(),
      },
    },
  },
};

// Mocks de los modelos globales de Sails (waterline)
global.Api = {
  findOne: jest.fn(),
};

global.ApiConnection = {
  findOne: jest.fn(),
};

global.ApiSubscription = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
};

global.ApiUsageLog = {
  create: jest.fn(),
  updateOne: jest.fn(),
};

const proxyModule = require('../../api/controllers/gateway/proxy');

// ─── Helpers de tests ─────────────────────────────────────────────────────────

/**
 * Construye un mock de req con todos los campos que usa el fn.
 */
function createReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/gateway/clima/forecast',
    params: { apiSlug: 'clima' },
    query: {},
    headers: {
      'user-agent': 'jest-test',
      host: 'localhost:1337',
      'content-type': 'application/json',
    },
    body: null,
    ip: '127.0.0.1',
    decoded: { sub: 'consumer-user-1' },
    ...overrides,
  };
}

/**
 * Construye un mock de res encadenable (res.status(...).json(...)).
 */
function createRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });

  res.send = jest.fn((payload) => {
    res.body = payload;
    return res;
  });

  res.setHeader = jest.fn((key, value) => {
    res.headers[key] = value;
  });

  return res;
}

/**
 * Construye un objeto Api válido por defecto.
 */
function buildApi(overrides = {}) {
  return {
    id: 'api-uuid-1',
    slug: 'clima',
    ...overrides,
  };
}

/**
 * Construye un objeto ApiConnection válido por defecto.
 */
function buildApiConnection(overrides = {}) {
  return {
    id: 'conn-1',
    api_id: 'api-uuid-1',
    status: 'active',
    auth_type: 'none',
    base_url: 'https://api-proveedor.com',
    credentials_encrypted: null,
    api_key_header_name: null,
    ...overrides,
  };
}

/**
 * Construye una suscripción activa con su plan poblado.
 */
function buildSubscription(overrides = {}) {
  return {
    id: 'sub-1',
    user_id: 'consumer-user-1',
    api_id: 'api-uuid-1',
    status: 'active',
    requests_used_this_month: 10,
    requests_used_this_day: 2,
    plan_id: {
      id: 'plan-1',
      max_requests_per_month: 1000,
    },
    ...overrides,
  };
}

/**
 * Configura los mocks para un happy path completo.
 * Cada test puede sobrescribir lo que necesite después.
 */
function setupHappyPath({ apiConnection, subscription } = {}) {
  Api.findOne.mockResolvedValue(buildApi());

  ApiConnection.findOne.mockResolvedValue(
    apiConnection || buildApiConnection()
  );

  ApiSubscription.findOne.mockReturnValue({
    populate: jest.fn().mockResolvedValue(subscription || buildSubscription()),
  });

  ApiUsageLog.create.mockReturnValue({
    fetch: jest.fn().mockResolvedValue({ id: 'log-1' }),
  });

  ApiUsageLog.updateOne.mockReturnValue({
    set: jest.fn().mockResolvedValue(true),
  });

  ApiSubscription.updateOne.mockReturnValue({
    set: jest.fn().mockResolvedValue(true),
  });
}

/**
 * Mockea _hacerProxyRequest con la respuesta deseada.
 */
function mockProxyRequest(response) {
  return jest
    .spyOn(proxyModule._private, '_hacerProxyRequest')
    .mockResolvedValue(response);
}

// ─── Setup global ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('proxy.fn — Errores de validación previos al proxy', () => {

  test('PXF-01 | API slug no existe → 404', async () => {
    Api.findOne.mockResolvedValue(null);

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ejecucion: expect.objectContaining({
          respuesta: expect.objectContaining({ estado: 'NOK' }),
        }),
      })
    );
    expect(sails.log.warn).toHaveBeenCalled();
  });

  test('PXF-02 | API existe pero sin conexión activa → 503', async () => {
    Api.findOne.mockResolvedValue(buildApi());
    ApiConnection.findOne.mockResolvedValue(null);

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ejecucion: expect.objectContaining({
          respuesta: expect.objectContaining({
            estado: 'NOK',
            mensaje: expect.stringContaining('disponible'),
          }),
        }),
      })
    );
  });

  test('PXF-03 | Sin suscripción activa → 403', async () => {
    Api.findOne.mockResolvedValue(buildApi());
    ApiConnection.findOne.mockResolvedValue(buildApiConnection());

    ApiSubscription.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ejecucion: expect.objectContaining({
          respuesta: expect.objectContaining({
            estado: 'NOK',
            mensaje: expect.stringContaining('suscripción'),
          }),
        }),
      })
    );
  });

  test('PXF-04 | Cuota mensual agotada → 429', async () => {
    setupHappyPath({
      subscription: buildSubscription({
        requests_used_this_month: 1000,
        plan_id: { id: 'plan-1', max_requests_per_month: 1000 },
      }),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ejecucion: expect.objectContaining({
          respuesta: expect.objectContaining({
            estado: 'NOK',
            mensaje: expect.stringContaining('límite'),
          }),
        }),
      })
    );
  });

  test('PXF-05 | Plan con max_requests_per_month=null permite continuar', async () => {
    setupHappyPath({
      subscription: buildSubscription({
        requests_used_this_month: 999999,
        plan_id: { id: 'plan-unlimited', max_requests_per_month: null },
      }),
    });

    mockProxyRequest({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('{"ok":true}'),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(res.status).toHaveBeenCalledWith(200);
  });

});

describe('proxy.fn — Happy path con auth_type none', () => {

  test('PXF-06 | Retransmite respuesta 200 al consumidor', async () => {
    setupHappyPath();

    const fakeBody = Buffer.from('{"forecast":"sunny"}');

    mockProxyRequest({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: fakeBody,
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(fakeBody);
  });

  test('PXF-07 | NO descifra credenciales si auth_type=none', async () => {
    setupHappyPath();
    mockProxyRequest({
      statusCode: 200,
      headers: {},
      body: Buffer.from(''),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(sails.helpers.gateway.cifrarCredenciales.with).not.toHaveBeenCalled();
  });

  test('PXF-08 | Crea ApiUsageLog antes de hacer el proxy', async () => {
    setupHappyPath();
    mockProxyRequest({
      statusCode: 200,
      headers: {},
      body: Buffer.from(''),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(ApiUsageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_id: 'sub-1',
        api_id: 'api-uuid-1',
        user_id: 'consumer-user-1',
        method: 'GET',
        endpoint_path: expect.any(String),
      })
    );
  });

  test('PXF-09 | Actualiza ApiUsageLog con statusCode y latencia', async () => {
    setupHappyPath();

    const setMock = jest.fn().mockResolvedValue(true);
    ApiUsageLog.updateOne.mockReturnValue({ set: setMock });

    mockProxyRequest({
      statusCode: 201,
      headers: {},
      body: Buffer.from(''),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(ApiUsageLog.updateOne).toHaveBeenCalledWith({ id: 'log-1' });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status_code: 201,
        response_time_ms: expect.any(Number),
        error_message: null,
      })
    );
  });

  test('PXF-10 | Incrementa requests_used_this_month y _this_day', async () => {
    setupHappyPath();

    const setMock = jest.fn().mockResolvedValue(true);
    ApiSubscription.updateOne.mockReturnValue({ set: setMock });

    mockProxyRequest({
      statusCode: 200,
      headers: {},
      body: Buffer.from(''),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(ApiSubscription.updateOne).toHaveBeenCalledWith({ id: 'sub-1' });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requests_used_this_month: 11, // 10 + 1
        requests_used_this_day: 3,    // 2 + 1
      })
    );
  });

  test('PXF-11 | Inyecta headers X-CoreAPI-Latency-Ms y X-CoreAPI-Api-Slug', async () => {
    setupHappyPath();
    mockProxyRequest({
      statusCode: 200,
      headers: {},
      body: Buffer.from(''),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-CoreAPI-Latency-Ms',
      expect.any(Number)
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-CoreAPI-Api-Slug',
      'clima'
    );
  });

  test('PXF-12 | Filtra headers bloqueados de la respuesta del proveedor', async () => {
    setupHappyPath();

    mockProxyRequest({
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'server': 'nginx/1.18',
        'x-powered-by': 'Express',
        'transfer-encoding': 'chunked',
        'x-custom-allowed': 'value',
      },
      body: Buffer.from(''),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    const setHeaderCalls = res.setHeader.mock.calls.map(([k]) => k.toLowerCase());

    expect(setHeaderCalls).not.toContain('server');
    expect(setHeaderCalls).not.toContain('x-powered-by');
    expect(setHeaderCalls).not.toContain('transfer-encoding');
    expect(setHeaderCalls).toContain('content-type');
    expect(setHeaderCalls).toContain('x-custom-allowed');
  });

});

describe('proxy.fn — Auth con credenciales cifradas', () => {

  test('PXF-13 | auth_type=bearer descifra credencial y agrega Authorization', async () => {
    setupHappyPath({
      apiConnection: buildApiConnection({
        auth_type: 'bearer',
        credentials_encrypted: 'iv:authTag:cipher',
      }),
    });

    sails.helpers.gateway.cifrarCredenciales.with.mockResolvedValue('TOKEN-XYZ');

    const proxySpy = mockProxyRequest({
      statusCode: 200,
      headers: {},
      body: Buffer.from(''),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(sails.helpers.gateway.cifrarCredenciales.with).toHaveBeenCalledWith({
      accion: 'descifrar',
      valor: 'iv:authTag:cipher',
    });

    const proxyCallArgs = proxySpy.mock.calls[0][0];
    expect(proxyCallArgs.headers.Authorization).toBe('Bearer TOKEN-XYZ');
  });

  test('PXF-14 | Error al descifrar credenciales → 500', async () => {
    setupHappyPath({
      apiConnection: buildApiConnection({
        auth_type: 'bearer',
        credentials_encrypted: 'iv:authTag:cipher',
      }),
    });

    sails.helpers.gateway.cifrarCredenciales.with.mockRejectedValue(
      new Error('E_CIFRADO')
    );

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ejecucion: expect.objectContaining({
          respuesta: expect.objectContaining({ estado: 'NOK' }),
        }),
      })
    );
    expect(sails.log.error).toHaveBeenCalled();
  });

});

describe('proxy.fn — Errores en el proxy hacia el proveedor', () => {

  test('PXF-15 | Proveedor responde con error → 502', async () => {
    setupHappyPath();

    jest
      .spyOn(proxyModule._private, '_hacerProxyRequest')
      .mockRejectedValue(new Error('Connection refused'));

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ejecucion: expect.objectContaining({
          respuesta: expect.objectContaining({
            estado: 'NOK',
            mensaje: expect.stringContaining('proveedor'),
          }),
        }),
      })
    );
    expect(sails.log.error).toHaveBeenCalled();
  });

  test('PXF-16 | En error 502, registra error_message en métrica', async () => {
    setupHappyPath();

    const setMock = jest.fn().mockResolvedValue(true);
    ApiUsageLog.updateOne.mockReturnValue({ set: setMock });

    jest
      .spyOn(proxyModule._private, '_hacerProxyRequest')
      .mockRejectedValue(new Error('Timeout: el proveedor no respondió'));

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status_code: 502,
        error_message: expect.stringContaining('Timeout'),
      })
    );
  });

  test('PXF-17 | Fallo al crear ApiUsageLog NO detiene la solicitud', async () => {
    Api.findOne.mockResolvedValue(buildApi());
    ApiConnection.findOne.mockResolvedValue(buildApiConnection());

    ApiSubscription.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(buildSubscription()),
    });

    ApiUsageLog.create.mockReturnValue({
      fetch: jest.fn().mockRejectedValue(new Error('DB log error')),
    });

    ApiSubscription.updateOne.mockReturnValue({
      set: jest.fn().mockResolvedValue(true),
    });

    mockProxyRequest({
      statusCode: 200,
      headers: {},
      body: Buffer.from(''),
    });

    const req = createReq();
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    expect(sails.log.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200); // sigue funcionando
  });

});

describe('proxy.fn — Manejo del body en métodos POST/PUT/PATCH', () => {

  test('PXF-18 | POST envía body al proveedor', async () => {
    setupHappyPath();

    const proxySpy = mockProxyRequest({
      statusCode: 201,
      headers: {},
      body: Buffer.from(''),
    });

    const req = createReq({
      method: 'POST',
      body: { name: 'test' },
    });
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    const proxyCallArgs = proxySpy.mock.calls[0][0];
    expect(proxyCallArgs.method).toBe('POST');
    expect(proxyCallArgs.body).toEqual({ name: 'test' });
  });

  test('PXF-19 | GET no envía body al proveedor', async () => {
    setupHappyPath();

    const proxySpy = mockProxyRequest({
      statusCode: 200,
      headers: {},
      body: Buffer.from(''),
    });

    const req = createReq({
      method: 'GET',
      body: { should: 'be ignored' },
    });
    const res = createRes();

    await proxyModule.fn.call({ req, res }, {}, {});

    const proxyCallArgs = proxySpy.mock.calls[0][0];
    expect(proxyCallArgs.body).toBeNull();
  });

});
