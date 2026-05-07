'use strict';

/**
 * __tests__/unit/registrar-api-overview.test.js
 *
 * Tests del helper api/helpers/catalogo/registrar-api-overview.js
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
  create: jest.fn(),
};

global.ApiUserInteraction = {
  create: jest.fn(),
};

const helper = require('../../api/helpers/catalogo/registrar-api-overview');

// ─── Helpers de tests ─────────────────────────────────────────────────────────

function defaultDatosApi(overrides = {}) {
  return {
    title: 'Movie Info API',
    type: 'GraphQL',
    short_summary: 'Access movie details, ratings, and cast.',
    price: 14.99,
    technology_stack: 'graphql,nodejs,mongodb',
    readme: '# Movie Info API\n\nGraphQL queries.',
    ...overrides,
  };
}

function withUsingConnection(returnValue) {
  return {
    usingConnection: jest.fn().mockResolvedValue(returnValue),
  };
}

/**
 * Configura Api.findOne con .usingConnection encadenado.
 */
function mockApiFindOne(returnValue) {
  Api.findOne.mockReturnValue(withUsingConnection(returnValue));
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
 * Configura Api.updateOne con .set().usingConnection() encadenado.
 */
function mockApiUpdateOne(returnValue) {
  const setMock = jest.fn(() => withUsingConnection(returnValue));
  Api.updateOne.mockReturnValue({ set: setMock });
  return setMock;
}

/**
 * Configura Api.create con .fetch().usingConnection() encadenado.
 */
function mockApiCreate(returnValue) {
  Api.create.mockReturnValue({
    fetch: jest.fn(() => withUsingConnection(returnValue)),
  });
}

/**
 * Configura ApiUserInteraction.create con .usingConnection encadenado.
 */
function mockInteractionCreate() {
  ApiUserInteraction.create.mockReturnValue(withUsingConnection(true));
}

beforeEach(() => {
  jest.clearAllMocks();

  Api.getDatastore.mockReturnValue({
    transaction: async (cb) => cb('mock-db'),
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('registrarApiOverview — Crear nuevo API', () => {

  test('RAO-01 | Sin apiId y con ownerId → crea nueva API', async () => {
    mockApiCreate({ id: 'api-new', title: 'Movie Info API' });
    mockInteractionCreate();

    const result = await helper.fn({
      datosApi: defaultDatosApi(),
      ownerId: 'owner-1',
    });

    expect(Api.create).toHaveBeenCalled();
    expect(result.id).toBe('api-new');
  });

  test('RAO-02 | Genera slug url-friendly a partir del título', async () => {
    mockApiCreate({ id: 'api-new' });
    mockInteractionCreate();

    await helper.fn({
      datosApi: defaultDatosApi({ title: 'Movie Info API' }),
      ownerId: 'owner-1',
    });

    const createCall = Api.create.mock.calls[0][0];
    expect(createCall.slug).toBe('movie-info-api');
  });

  test('RAO-03 | Slug remueve caracteres especiales', async () => {
    mockApiCreate({ id: 'api-new' });
    mockInteractionCreate();

    await helper.fn({
      datosApi: defaultDatosApi({ title: '¡API Genial! @#$ 2024' }),
      ownerId: 'owner-1',
    });

    const createCall = Api.create.mock.calls[0][0];
    expect(createCall.slug).toBe('api-genial-2024');
  });

  test('RAO-04 | Slug colapsa espacios múltiples en un guión', async () => {
    mockApiCreate({ id: 'api-new' });
    mockInteractionCreate();

    await helper.fn({
      datosApi: defaultDatosApi({ title: 'My    API   Test' }),
      ownerId: 'owner-1',
    });

    const createCall = Api.create.mock.calls[0][0];
    expect(createCall.slug).toBe('my-api-test');
  });

  test('RAO-05 | Slug se trunca a 160 caracteres', async () => {
    mockApiCreate({ id: 'api-new' });
    mockInteractionCreate();

    const tituloLargo = 'a'.repeat(200);

    await helper.fn({
      datosApi: defaultDatosApi({ title: tituloLargo }),
      ownerId: 'owner-1',
    });

    const createCall = Api.create.mock.calls[0][0];
    expect(createCall.slug.length).toBeLessThanOrEqual(160);
  });

  test('RAO-06 | Sin ownerId → lanza E_MISSING_OWNER', async () => {
    await expect(
      helper.fn({
        datosApi: defaultDatosApi(),
      })
    ).rejects.toMatchObject({ code: 'E_MISSING_OWNER' });
  });

  test('RAO-07 | E_MISSING_OWNER NO se envuelve en E_REGISTRAR_API_OVERVIEW', async () => {
    try {
      await helper.fn({ datosApi: defaultDatosApi() });
      throw new Error('debería haber lanzado');
    } catch (error) {
      expect(error.code).toBe('E_MISSING_OWNER');
    }
  });

  test('RAO-08 | Crea ApiUserInteraction con favorite=false para el owner', async () => {
    mockApiCreate({ id: 'api-new' });
    mockInteractionCreate();

    await helper.fn({
      datosApi: defaultDatosApi(),
      ownerId: 'owner-1',
    });

    expect(ApiUserInteraction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        favorite: false,
        user_id: 'owner-1',
        api_id: 'api-new',
      })
    );
  });

  test('RAO-09 | Inicializa rating_count, rating_average y views en 0', async () => {
    mockApiCreate({ id: 'api-new' });
    mockInteractionCreate();

    await helper.fn({
      datosApi: defaultDatosApi(),
      ownerId: 'owner-1',
    });

    const createCall = Api.create.mock.calls[0][0];
    expect(createCall.rating_count).toBe(0);
    expect(createCall.rating_average).toBe(0);
    expect(createCall.views).toBe(0);
  });

  test('RAO-10 | Si datosApi.price es undefined → guarda 0', async () => {
    mockApiCreate({ id: 'api-new' });
    mockInteractionCreate();

    await helper.fn({
      datosApi: { title: 'Test API' }, // sin price
      ownerId: 'owner-1',
    });

    const createCall = Api.create.mock.calls[0][0];
    expect(createCall.price).toBe(0);
  });

  test('RAO-11 | Si type/summary/stack/readme no vienen → guarda null', async () => {
    mockApiCreate({ id: 'api-new' });
    mockInteractionCreate();

    await helper.fn({
      datosApi: { title: 'Test API' },
      ownerId: 'owner-1',
    });

    const createCall = Api.create.mock.calls[0][0];
    expect(createCall.type).toBeNull();
    expect(createCall.short_summary).toBeNull();
    expect(createCall.technology_stack).toBeNull();
    expect(createCall.readme).toBeNull();
  });

});

describe('registrarApiOverview — Actualizar API existente', () => {

  test('RAO-12 | Con apiId existente → actualiza, no crea', async () => {
    // Primer findOne para verificar existencia
    // Segundo findOne (con .populate) para retornar el actualizado
    Api.findOne
      .mockReturnValueOnce(withUsingConnection({ id: 'api-1', title: 'Old' }))
      .mockReturnValueOnce({
        populate: jest.fn(() =>
          withUsingConnection({ id: 'api-1', title: 'New' })
        ),
      });

    mockApiUpdateOne(true);

    const result = await helper.fn({
      apiId: 'api-1',
      datosApi: { title: 'New' },
    });

    expect(Api.create).not.toHaveBeenCalled();
    expect(Api.updateOne).toHaveBeenCalledWith({ id: 'api-1' });
    expect(result.title).toBe('New');
  });

  test('RAO-13 | Solo actualiza los campos provistos en datosApi', async () => {
    Api.findOne
      .mockReturnValueOnce(withUsingConnection({ id: 'api-1' }))
      .mockReturnValueOnce({
        populate: jest.fn(() => withUsingConnection({ id: 'api-1' })),
      });

    const setMock = mockApiUpdateOne(true);

    await helper.fn({
      apiId: 'api-1',
      datosApi: { title: 'Solo título nuevo' }, // solo title
    });

    const payload = setMock.mock.calls[0][0];
    expect(payload.title).toBe('Solo título nuevo');
    expect(payload.type).toBeUndefined();
    expect(payload.short_summary).toBeUndefined();
    expect(payload.updated_at).toBeInstanceOf(Date);
  });

  test('RAO-14 | Si apiId no existe → cae al flujo de creación (necesita ownerId)', async () => {
    // Primera busqueda → null (no existe)
    Api.findOne.mockReturnValueOnce(withUsingConnection(null));

    await expect(
      helper.fn({
        apiId: 'no-existe',
        datosApi: defaultDatosApi(),
        // sin ownerId → debería lanzar E_MISSING_OWNER
      })
    ).rejects.toMatchObject({ code: 'E_MISSING_OWNER' });
  });

  test('RAO-15 | Actualizar todos los campos: title, type, summary, price, stack, readme', async () => {
    Api.findOne
      .mockReturnValueOnce(withUsingConnection({ id: 'api-1' }))
      .mockReturnValueOnce({
        populate: jest.fn(() => withUsingConnection({ id: 'api-1' })),
      });

    const setMock = mockApiUpdateOne(true);

    await helper.fn({
      apiId: 'api-1',
      datosApi: {
        title: 'T',
        type: 'REST',
        short_summary: 'S',
        price: 9.99,
        technology_stack: 'node',
        readme: 'README',
      },
    });

    const payload = setMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: 'T',
      type: 'REST',
      short_summary: 'S',
      price: 9.99,
      technology_stack: 'node',
      readme: 'README',
    });
  });

});

describe('registrarApiOverview — Manejo de errores', () => {

  test('RAO-16 | Error en BD → lanza E_REGISTRAR_API_OVERVIEW', async () => {
    Api.getDatastore.mockReturnValue({
      transaction: jest.fn().mockRejectedValue(new Error('DB fail')),
    });

    await expect(
      helper.fn({
        datosApi: defaultDatosApi(),
        ownerId: 'owner-1',
      })
    ).rejects.toMatchObject({ code: 'E_REGISTRAR_API_OVERVIEW' });
  });

  test('RAO-17 | En cualquier error registra sails.log.error', async () => {
    Api.getDatastore.mockReturnValue({
      transaction: jest.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(
      helper.fn({ datosApi: defaultDatosApi(), ownerId: 'owner-1' })
    ).rejects.toThrow();

    expect(sails.log.error).toHaveBeenCalled();
  });

});
