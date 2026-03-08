'use strict';

const proxyquire = require('proxyquire').noCallThru();

function makeUpdateOneMock(resolvedValue = { id: '1' }) {
  const usingConnection = jest.fn().mockResolvedValue(resolvedValue);
  const set = jest.fn().mockReturnValue({ usingConnection });
  const updateOne = jest.fn().mockReturnValue({ set });
  return { updateOne, set, usingConnection };
}

function makeCreateMock(resolvedValue = { id: 'new-1' }) {
  const usingConnection = jest.fn().mockResolvedValue(resolvedValue);
  const create = jest.fn().mockReturnValue({ usingConnection });
  return { create, usingConnection };
}

function buildMocks({
  existingInteraction = null,
  ratingsInDb = [],
  updateOneResult = { id: '1' },
  createResult = { id: 'new-1' },
  apiUpdateResult = { id: 'api-1' },
  transactionShouldFail = false,
} = {}) {

  const { updateOne: apiUpdateOne } = makeUpdateOneMock(apiUpdateResult);

  const interactionUpdateMock = makeUpdateOneMock(updateOneResult);
  const interactionCreateMock = makeCreateMock(createResult);

  const ApiUserInteractionMock = {
    findOne: jest.fn().mockResolvedValue(existingInteraction),
    updateOne: interactionUpdateMock.updateOne,
    create: interactionCreateMock.create,
    find: jest.fn().mockResolvedValue(ratingsInDb),
  };

  const ApiMock = {
    updateOne: apiUpdateOne,
    getDatastore: jest.fn().mockReturnValue({
      transaction: jest.fn().mockImplementation(async (cb) => {
        if (transactionShouldFail) throw new Error('DB connection failed');
        await cb('mock-db-connection');
      }),
    }),
  };

  return { ApiUserInteractionMock, ApiMock };
}

global.sails = {
  log: {
    verbose: jest.fn(),
    error:   jest.fn(),
  },
};

const helperModule = require('../../api/helpers/catalogo/registrar-valoracion-favorito');

async function runHelper(inputs, mocks) {
  global.Api = mocks.ApiMock;
  global.ApiUserInteraction = mocks.ApiUserInteractionMock;
  return helperModule.fn(inputs);
}

beforeEach(() => {
  jest.clearAllMocks();
  delete global.Api;
  delete global.ApiUserInteraction;
});

describe('registrarValoracionFavorito — Primera interacción', () => {

  test('RF-01 | Sin interacción previa - crea nueva con favorite=true', async () => {
    const mocks = buildMocks({
      existingInteraction: null,
      ratingsInDb: [],
    });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: null },
      mocks
    );

    expect(mocks.ApiUserInteractionMock.create).toHaveBeenCalledTimes(1);
    expect(mocks.ApiUserInteractionMock.updateOne).not.toHaveBeenCalled();
  });

  test('RF-02 | Primera interacción - favorite se crea como true', async () => {
    const mocks = buildMocks({ existingInteraction: null });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: null },
      mocks
    );

    const createCall = mocks.ApiUserInteractionMock.create.mock.calls[0][0];
    expect(createCall.favorite).toBe(true);
  });

  test('RF-03 | Primera interacción con rating=4 - se guarda el rating', async () => {
    const mocks = buildMocks({
      existingInteraction: null,
      ratingsInDb: [{ rating: 4 }],
    });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: 4 },
      mocks
    );

    const createCall = mocks.ApiUserInteractionMock.create.mock.calls[0][0];
    expect(createCall.rating).toBe(4);
  });

});

describe('registrarValoracionFavorito — Toggle de favorito', () => {

  test('RF-04 | Interacción existente con favorite=true - actualiza a false', async () => {
    const mocks = buildMocks({
      existingInteraction: { id: 'int-1', favorite: true, rating: null },
      ratingsInDb: [],
    });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: null },
      mocks
    );

    expect(mocks.ApiUserInteractionMock.updateOne).toHaveBeenCalledTimes(1);
    const setCall = mocks.ApiUserInteractionMock.updateOne.mock.results[0].value.set;
    const setArgs = setCall.mock.calls[0][0];
    expect(setArgs.favorite).toBe(false);
  });

  test('RF-05 | Interacción existente con favorite=false - actualiza a true', async () => {
    const mocks = buildMocks({
      existingInteraction: { id: 'int-1', favorite: false, rating: null },
      ratingsInDb: [],
    });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: null },
      mocks
    );

    const setCall = mocks.ApiUserInteractionMock.updateOne.mock.results[0].value.set;
    const setArgs = setCall.mock.calls[0][0];
    expect(setArgs.favorite).toBe(true);
  });

  test('RF-06 | Rating null al actualizar - mantiene el rating previo', async () => {
    const mocks = buildMocks({
      existingInteraction: { id: 'int-1', favorite: true, rating: 3 },
      ratingsInDb: [{ rating: 3 }],
    });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: null },
      mocks
    );

    const setCall = mocks.ApiUserInteractionMock.updateOne.mock.results[0].value.set;
    const setArgs = setCall.mock.calls[0][0];
    expect(setArgs.rating).toBe(3);
  });

  test('RF-07 | Nuevo rating=5 al actualizar - reemplaza el rating previo', async () => {
    const mocks = buildMocks({
      existingInteraction: { id: 'int-1', favorite: true, rating: 2 },
      ratingsInDb: [{ rating: 5 }],
    });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: 5 },
      mocks
    );

    const setCall = mocks.ApiUserInteractionMock.updateOne.mock.results[0].value.set;
    const setArgs = setCall.mock.calls[0][0];
    expect(setArgs.rating).toBe(5);
  });

});

describe('registrarValoracionFavorito — Recálculo de rating_average', () => {

  test('RF-08 | Sin ratings - rating_average = "0.00"', async () => {
    const mocks = buildMocks({
      existingInteraction: null,
      ratingsInDb: [],
    });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: null },
      mocks
    );

    const apiSetCall = mocks.ApiMock.updateOne.mock.results[0].value.set;
    const apiSetArgs = apiSetCall.mock.calls[0][0];
    expect(apiSetArgs.rating_average).toBe('0.00');
    expect(apiSetArgs.rating_count).toBe(0);
  });

  test('RF-09 | Un rating=4 - rating_average = "4.00", rating_count = 1', async () => {
    const mocks = buildMocks({
      existingInteraction: null,
      ratingsInDb: [{ rating: 4 }],
    });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: 4 },
      mocks
    );

    const apiSetCall = mocks.ApiMock.updateOne.mock.results[0].value.set;
    const apiSetArgs = apiSetCall.mock.calls[0][0];
    expect(apiSetArgs.rating_average).toBe('4.00');
    expect(apiSetArgs.rating_count).toBe(1);
  });

  test('RF-10 | Dos ratings [4, 2] - rating_average = "3.00", rating_count = 2', async () => {
    const mocks = buildMocks({
      existingInteraction: null,
      ratingsInDb: [{ rating: 4 }, { rating: 2 }],
    });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: 4 },
      mocks
    );

    const apiSetCall = mocks.ApiMock.updateOne.mock.results[0].value.set;
    const apiSetArgs = apiSetCall.mock.calls[0][0];
    expect(apiSetArgs.rating_average).toBe('3.00');
    expect(apiSetArgs.rating_count).toBe(2);
  });

  test('RF-11 | Api.updateOne se llama exactamente 1 vez', async () => {
    const mocks = buildMocks({ existingInteraction: null, ratingsInDb: [] });

    await runHelper(
      { apiId: 'api-1', userId: 'user-1', rating: null },
      mocks
    );

    expect(mocks.ApiMock.updateOne).toHaveBeenCalledTimes(1);
  });

  test('RF-12 | Api.updateOne se llama con el apiId correcto', async () => {
    const mocks = buildMocks({ existingInteraction: null, ratingsInDb: [] });

    await runHelper(
      { apiId: 'api-xyz', userId: 'user-1', rating: null },
      mocks
    );

    expect(mocks.ApiMock.updateOne).toHaveBeenCalledWith({ id: 'api-xyz' });
  });

});

describe('registrarValoracionFavorito — Error de base de datos', () => {

  test('RF-13 | Fallo en transacción - lanza error con code E_REG_VAL_FAV', async () => {
    const mocks = buildMocks({ transactionShouldFail: true });

    await expect(
      runHelper({ apiId: 'api-1', userId: 'user-1', rating: null }, mocks)
    ).rejects.toMatchObject({ code: 'E_REG_VAL_FAV' });
  });

  test('RF-14 | Fallo en transacción - registra en sails.log.error', async () => {
    const mocks = buildMocks({ transactionShouldFail: true });

    await expect(
      runHelper({ apiId: 'api-1', userId: 'user-1', rating: null }, mocks)
    ).rejects.toBeDefined();

    expect(sails.log.error).toHaveBeenCalledTimes(1);
  });

});
