'use strict';

/**
 * __tests__/unit/actualizar-views.test.js
 *
 * Tests del helper api/helpers/catalogo/actualizar-views.js
 */

global.sails = {
  log: {
    verbose: jest.fn(),
    error: jest.fn(),
  },
};

global.Api = {
  getDatastore: jest.fn(() => ({
    transaction: async (cb) => cb('mock-db'),
  })),
  findOne: jest.fn(),
  updateOne: jest.fn(),
};

global.ApiUserInteraction = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
};

const helper = require('../../api/helpers/catalogo/actualizar-views');

// ─── Helpers de tests ─────────────────────────────────────────────────────────

function buildApi(overrides = {}) {
  return {
    id: 'api-1',
    title: 'Test API',
    views: 100,
    ...overrides,
  };
}

/**
 * Configura Api.findOne con .usingConnection encadenado.
 */
function mockApiFindOne(returnValue) {
  Api.findOne.mockReturnValue({
    usingConnection: jest.fn().mockResolvedValue(returnValue),
  });
}

/**
 * Configura Api.updateOne con .set().usingConnection() encadenado.
 */
function mockApiUpdateOne(returnValue) {
  const setMock = jest.fn(() => ({
    usingConnection: jest.fn().mockResolvedValue(returnValue),
  }));
  Api.updateOne.mockReturnValue({ set: setMock });
  return setMock;
}

/**
 * Configura ApiUserInteraction.findOne con .usingConnection encadenado.
 */
function mockInteractionFindOne(returnValue) {
  ApiUserInteraction.findOne.mockReturnValue({
    usingConnection: jest.fn().mockResolvedValue(returnValue),
  });
}

/**
 * Configura ApiUserInteraction.updateOne encadenado.
 */
function mockInteractionUpdateOne() {
  ApiUserInteraction.updateOne.mockReturnValue({
    set: jest.fn(() => ({
      usingConnection: jest.fn().mockResolvedValue(true),
    })),
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  // Restaurar el datastore por defecto
  Api.getDatastore.mockReturnValue({
    transaction: async (cb) => cb('mock-db'),
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('actualizarViews — Validación de la API', () => {

  test('AV-01 | API no existe → lanza E_API_NOT_FOUND', async () => {
    mockApiFindOne(null);

    await expect(
      helper.fn({ apiId: 'no-existe', trackUnique: false, uniqueWindow: 3600 })
    ).rejects.toMatchObject({ code: 'E_API_NOT_FOUND' });
  });

  test('AV-02 | E_API_NOT_FOUND NO se envuelve en E_ACTUALIZAR_API_VIEWS', async () => {
    mockApiFindOne(null);

    try {
      await helper.fn({ apiId: 'no-existe', trackUnique: false, uniqueWindow: 3600 });
      throw new Error('debería haber lanzado');
    } catch (error) {
      expect(error.code).toBe('E_API_NOT_FOUND');
      expect(error.code).not.toBe('E_ACTUALIZAR_API_VIEWS');
    }
  });

});

describe('actualizarViews — Sin tracking único', () => {

  beforeEach(() => {
    mockApiFindOne(buildApi({ views: 100 }));
    mockApiUpdateOne(buildApi({ views: 101 }));
  });

  test('AV-03 | trackUnique=false → siempre cuenta la vista', async () => {
    const result = await helper.fn({
      apiId: 'api-1',
      trackUnique: false,
      uniqueWindow: 3600,
    });

    expect(result.success).toBe(true);
    expect(result.data.viewCounted).toBe(true);
    expect(result.data.totalViews).toBe(101);
    expect(result.data.isUnique).toBe(true);
  });

  test('AV-04 | Llama Api.updateOne para incrementar views', async () => {
    const setMock = mockApiUpdateOne(buildApi({ views: 101 }));

    await helper.fn({
      apiId: 'api-1',
      trackUnique: false,
      uniqueWindow: 3600,
    });

    expect(Api.updateOne).toHaveBeenCalledWith({ id: 'api-1' });
    expect(setMock).toHaveBeenCalledWith({ views: 101 });
  });

  test('AV-05 | El mensaje indica vista contada exitosamente', async () => {
    const result = await helper.fn({
      apiId: 'api-1',
      trackUnique: false,
      uniqueWindow: 3600,
    });

    expect(result.message).toBe('View counted successfully');
  });

});

describe('actualizarViews — Tracking único con userId', () => {

  beforeEach(() => {
    mockApiFindOne(buildApi({ views: 50 }));
  });

  test('AV-06 | Sin interacción previa → cuenta como única', async () => {
    mockInteractionFindOne(null);
    mockApiUpdateOne(buildApi({ views: 51 }));

    const result = await helper.fn({
      apiId: 'api-1',
      userId: 'user-1',
      trackUnique: true,
      uniqueWindow: 3600,
    });

    expect(result.data.viewCounted).toBe(true);
    expect(result.data.isUnique).toBe(true);
  });

  test('AV-07 | Interacción reciente (dentro de la ventana) → NO cuenta', async () => {
    // Simular vista hace 10 minutos (ventana = 1 hora)
    const haceDiezMinutos = new Date(Date.now() - 10 * 60 * 1000);

    mockInteractionFindOne({
      id: 'inter-1',
      updated_at: haceDiezMinutos,
    });
    mockInteractionUpdateOne();

    const result = await helper.fn({
      apiId: 'api-1',
      userId: 'user-1',
      trackUnique: true,
      uniqueWindow: 3600, // 1 hora
    });

    expect(result.data.viewCounted).toBe(false);
    expect(result.data.totalViews).toBe(50); // sigue igual
    expect(Api.updateOne).not.toHaveBeenCalled();
  });

  test('AV-08 | Interacción antigua (fuera de la ventana) → cuenta como única', async () => {
    // Simular vista hace 2 horas (ventana = 1 hora)
    const haceDosHoras = new Date(Date.now() - 2 * 60 * 60 * 1000);

    mockInteractionFindOne({
      id: 'inter-1',
      updated_at: haceDosHoras,
    });
    mockInteractionUpdateOne();
    mockApiUpdateOne(buildApi({ views: 51 }));

    const result = await helper.fn({
      apiId: 'api-1',
      userId: 'user-1',
      trackUnique: true,
      uniqueWindow: 3600,
    });

    expect(result.data.viewCounted).toBe(true);
    expect(result.data.isUnique).toBe(true);
  });

  test('AV-09 | Interacción sin updated_at → cuenta como única', async () => {
    mockInteractionFindOne({
      id: 'inter-1',
      updated_at: null,
    });
    mockInteractionUpdateOne();
    mockApiUpdateOne(buildApi({ views: 51 }));

    const result = await helper.fn({
      apiId: 'api-1',
      userId: 'user-1',
      trackUnique: true,
      uniqueWindow: 3600,
    });

    expect(result.data.isUnique).toBe(true);
  });

  test('AV-10 | Si existe interacción → actualiza su updated_at', async () => {
    const haceDosHoras = new Date(Date.now() - 2 * 60 * 60 * 1000);

    mockInteractionFindOne({
      id: 'inter-1',
      updated_at: haceDosHoras,
    });

    const interactionSetMock = jest.fn(() => ({
      usingConnection: jest.fn().mockResolvedValue(true),
    }));
    ApiUserInteraction.updateOne.mockReturnValue({ set: interactionSetMock });

    mockApiUpdateOne(buildApi({ views: 51 }));

    await helper.fn({
      apiId: 'api-1',
      userId: 'user-1',
      trackUnique: true,
      uniqueWindow: 3600,
    });

    expect(ApiUserInteraction.updateOne).toHaveBeenCalledWith({ id: 'inter-1' });
    const payload = interactionSetMock.mock.calls[0][0];
    expect(payload.updated_at).toBeInstanceOf(Date);
  });

});

describe('actualizarViews — Tracking único con sessionId (anónimo)', () => {

  beforeEach(() => {
    mockApiFindOne(buildApi({ views: 30 }));
    mockApiUpdateOne(buildApi({ views: 31 }));
  });

  test('AV-11 | Solo sessionId (sin userId) → siempre cuenta como única', async () => {
    const result = await helper.fn({
      apiId: 'api-1',
      sessionId: 'session-abc',
      trackUnique: true,
      uniqueWindow: 3600,
    });

    expect(result.data.viewCounted).toBe(true);
    expect(result.data.isUnique).toBe(true);
    // No debería consultar ApiUserInteraction porque no hay userId
    expect(ApiUserInteraction.findOne).not.toHaveBeenCalled();
  });

});

describe('actualizarViews — trackUnique sin identificador', () => {

  beforeEach(() => {
    mockApiFindOne(buildApi({ views: 200 }));
    mockApiUpdateOne(buildApi({ views: 201 }));
  });

  test('AV-12 | trackUnique=true pero sin userId ni sessionId → cuenta normal', async () => {
    const result = await helper.fn({
      apiId: 'api-1',
      trackUnique: true,
      uniqueWindow: 3600,
    });

    // Como no hay userId ni sessionId, el if de trackUnique no entra,
    // cae en el else y siempre cuenta
    expect(result.data.viewCounted).toBe(true);
    expect(result.data.isUnique).toBe(true);
  });

});

describe('actualizarViews — Manejo de errores', () => {

  test('AV-13 | Error en BD durante la transacción → lanza E_ACTUALIZAR_API_VIEWS', async () => {
    Api.getDatastore.mockReturnValue({
      transaction: jest.fn().mockRejectedValue(new Error('DB connection failed')),
    });

    await expect(
      helper.fn({ apiId: 'api-1', trackUnique: false, uniqueWindow: 3600 })
    ).rejects.toMatchObject({ code: 'E_ACTUALIZAR_API_VIEWS' });
  });

  test('AV-14 | En cualquier error registra sails.log.error', async () => {
    Api.getDatastore.mockReturnValue({
      transaction: jest.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(
      helper.fn({ apiId: 'api-1', trackUnique: false, uniqueWindow: 3600 })
    ).rejects.toThrow();

    expect(sails.log.error).toHaveBeenCalled();
  });

});
