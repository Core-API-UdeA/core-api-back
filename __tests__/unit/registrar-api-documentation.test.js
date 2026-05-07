// ─── registrar-api-documentation.test.js ─────────────────────────────────────
// Pruebas unitarias para api/helpers/catalogo/registrar-api-documentation.js
// Mockea: Api, ApiVersion, ApiEndpoint, ApiParameter, ApiBody, ApiResponse, uuid
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("uuid", () => ({ v4: jest.fn(() => "mocked-uuid") }));

// ── Mock de sails global ──────────────────────────────────────────────────────
global.sails = {
  log: {
    verbose: jest.fn(),
    error:   jest.fn(),
    warn:    jest.fn(),
  },
};

// ── Helpers para construir mocks de modelos Waterline ─────────────────────────
function makeModel(overrides = {}) {
  return {
    findOne:   jest.fn(),
    find:      jest.fn(),
    create:    jest.fn(),
    updateOne: jest.fn(),
    destroy:   jest.fn(),
    ...overrides,
  };
}

// ── Modelos globales ──────────────────────────────────────────────────────────
global.Api         = makeModel();
global.ApiVersion  = makeModel();
global.ApiEndpoint = makeModel();
global.ApiParameter= makeModel();
global.ApiBody     = makeModel();
global.ApiResponse = makeModel();

// ── Mock del getDatastore().transaction ──────────────────────────────────────
// La transacción ejecuta el callback con un objeto db y lo resuelve
global.Api.getDatastore = jest.fn(() => ({
  transaction: jest.fn(async (cb) => cb("mock-db-connection")),
}));

// ── Cargar el helper ──────────────────────────────────────────────────────────
const helper = require("../../api/helpers/catalogo/registrar-api-documentation");

// ── Función invocadora ────────────────────────────────────────────────────────
async function callHelper(inputs) {
  return helper.fn.call({}, inputs);
}

// ── Datos de prueba ───────────────────────────────────────────────────────────
const VALID_API_ID      = "api-uuid-001";
const VALID_VERSION     = "v1";
const MOCK_API          = { id: VALID_API_ID, title: "Mi API de prueba" };
const MOCK_API_VERSION  = { id: "ver-uuid-001", api_id: VALID_API_ID, version_name: "v1" };

const SIMPLE_ENDPOINT = {
  path:        "/users",
  method:      "GET",
  description: "Lista usuarios",
  parameters:  [],
  headers:     [],
  bodies:      [],
  responses:   [{ status_code: 200, content_type: "application/json", example: {} }],
};

const FULL_ENDPOINT = {
  path:        "/users",
  method:      "POST",
  description: "Crea usuario",
  parameters:  [{ name: "page", type: "integer", required: false, location: "query" }],
  headers:     [{ name: "Authorization", type: "string", required: true, location: "header" }],
  bodies:      [{ content_type: "application/json", example: { name: "Juan" } }],
  responses:   [
    { status_code: 201, content_type: "application/json", example: { id: 1 } },
    { status_code: 400, content_type: "application/json", example: { error: "bad" } },
  ],
};

// ── Setup por defecto ─────────────────────────────────────────────────────────
function setupDefaultMocks() {
  jest.clearAllMocks();

  // Api.findOne → API existe
  global.Api.findOne.mockReturnValue({
    usingConnection: jest.fn().mockResolvedValue(MOCK_API),
  });

  // ApiVersion.findOne → no existe (nueva versión)
  global.ApiVersion.findOne.mockReturnValue({
    usingConnection: jest.fn().mockResolvedValue(null),
  });

  // ApiVersion.create
  global.ApiVersion.create.mockReturnValue({
    fetch: jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(MOCK_API_VERSION),
    }),
  });

  // ApiEndpoint.create
  global.ApiEndpoint.create.mockReturnValue({
    fetch: jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({ id: "ep-001", method: "GET", path: "/users" }),
    }),
  });

  // ApiParameter.create
  global.ApiParameter.create.mockReturnValue({
    fetch: jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({ id: "param-001", name: "page" }),
    }),
  });

  // ApiBody.create
  global.ApiBody.create.mockReturnValue({
    fetch: jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({ id: "body-001" }),
    }),
  });

  // ApiResponse.create
  global.ApiResponse.create.mockReturnValue({
    fetch: jest.fn().mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue({ id: "resp-001", status_code: 200 }),
    }),
  });

  // ApiEndpoint.find (verificación final)
  global.ApiEndpoint.find.mockReturnValue({
    usingConnection: jest.fn().mockResolvedValue([
      { id: "ep-001", method: "GET", path: "/users" },
    ]),
  });

  // Destroy mocks
  global.ApiEndpoint.destroy.mockReturnValue({ usingConnection: jest.fn().mockResolvedValue([]) });
  global.ApiParameter.destroy.mockReturnValue({ usingConnection: jest.fn().mockResolvedValue([]) });
  global.ApiBody.destroy.mockReturnValue({ usingConnection: jest.fn().mockResolvedValue([]) });
  global.ApiResponse.destroy.mockReturnValue({ usingConnection: jest.fn().mockResolvedValue([]) });
  global.ApiVersion.updateOne.mockReturnValue({
    set: jest.fn().mockReturnValue({ usingConnection: jest.fn().mockResolvedValue(MOCK_API_VERSION) }),
  });

  // resetear transaction mock
  global.Api.getDatastore = jest.fn(() => ({
    transaction: jest.fn(async (cb) => cb("mock-db-connection")),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
describe("registrarApiDocumentation — Happy Path: nueva versión", () => {

  beforeEach(setupDefaultMocks);

  it("RAD-01 | Retorna success=true con datos de versión y stats", async () => {
    const result = await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    });

    expect(result.success).toBe(true);
    expect(result.version.version_name).toBe("v1");
    expect(result.stats.totalEndpoints).toBe(1);
  });

  it("RAD-02 | Llama Api.findOne para verificar que la API existe", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    });

    expect(global.Api.findOne).toHaveBeenCalledWith({ id: VALID_API_ID });
  });

  it("RAD-03 | Llama ApiVersion.create cuando la versión no existe", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    });

    expect(global.ApiVersion.create).toHaveBeenCalledTimes(1);
    const args = global.ApiVersion.create.mock.calls[0][0];
    expect(args.version_name).toBe(VALID_VERSION);
    expect(args.api_id).toBe(VALID_API_ID);
  });

  it("RAD-04 | Llama ApiEndpoint.create por cada endpoint válido", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT, FULL_ENDPOINT], updateExisting: false,
    });

    expect(global.ApiEndpoint.create).toHaveBeenCalledTimes(2);
  });

  it("RAD-05 | El mensaje indica creación exitosa", async () => {
    const result = await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    });

    expect(result.message).toContain("created successfully");
    expect(result.message).toContain(VALID_VERSION);
  });

  it("RAD-06 | stats.totalCreated refleja el número de endpoints procesados", async () => {
    const result = await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT, FULL_ENDPOINT], updateExisting: false,
    });

    expect(result.stats.totalCreated).toBe(2);
    expect(result.stats.totalUpdated).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe("registrarApiDocumentation — Happy Path: actualizar versión existente", () => {

  beforeEach(() => {
    setupDefaultMocks();
    // Sobreescribir: la versión SÍ existe
    global.ApiVersion.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(MOCK_API_VERSION),
    });
    // ApiEndpoint.find para eliminar antiguos
    global.ApiEndpoint.find.mockReturnValue({
      usingConnection: jest.fn()
        .mockResolvedValueOnce([{ id: "ep-old-001" }, { id: "ep-old-002" }]) // para eliminar
        .mockResolvedValue([{ id: "ep-001", method: "GET", path: "/users" }]), // verificación final
    });
  });

  it("RAD-07 | updateExisting=true → elimina endpoints antiguos", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: true,
    });

    expect(global.ApiEndpoint.destroy).toHaveBeenCalled();
  });

  it("RAD-08 | updateExisting=true → elimina parámetros, bodies y responses de endpoints antiguos", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: true,
    });

    expect(global.ApiParameter.destroy).toHaveBeenCalled();
    expect(global.ApiBody.destroy).toHaveBeenCalled();
    expect(global.ApiResponse.destroy).toHaveBeenCalled();
  });

  it("RAD-09 | updateExisting=true → stats.totalUpdated refleja endpoints procesados", async () => {
    const result = await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: true,
    });

    expect(result.stats.totalUpdated).toBe(1);
    expect(result.stats.totalCreated).toBe(0);
  });

  it("RAD-10 | updateExisting=true → el mensaje indica actualización", async () => {
    const result = await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: true,
    });

    expect(result.message).toContain("updated successfully");
  });

  it("RAD-11 | updateExisting=true con changelog → actualiza el changelog", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      changelog: "Se añadió endpoint de usuarios",
      endpoints: [SIMPLE_ENDPOINT], updateExisting: true,
    });

    expect(global.ApiVersion.updateOne).toHaveBeenCalledWith({ id: MOCK_API_VERSION.id });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe("registrarApiDocumentation — Creación de relaciones", () => {

  beforeEach(setupDefaultMocks);

  it("RAD-12 | Crea los parámetros del endpoint (query + headers fusionados)", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [FULL_ENDPOINT], updateExisting: false,
    });

    // FULL_ENDPOINT tiene 1 parameter + 1 header = 2 llamadas
    expect(global.ApiParameter.create).toHaveBeenCalledTimes(2);
  });

  it("RAD-13 | Crea los bodies del endpoint", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [FULL_ENDPOINT], updateExisting: false,
    });

    expect(global.ApiBody.create).toHaveBeenCalledTimes(1);
    const args = global.ApiBody.create.mock.calls[0][0];
    expect(args.content_type).toBe("application/json");
  });

  it("RAD-14 | Crea todas las responses del endpoint", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [FULL_ENDPOINT], updateExisting: false,
    });

    // FULL_ENDPOINT tiene 2 responses
    expect(global.ApiResponse.create).toHaveBeenCalledTimes(2);
  });

  it("RAD-15 | Endpoint sin parameters ni headers no llama ApiParameter.create", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    });

    expect(global.ApiParameter.create).not.toHaveBeenCalled();
  });

  it("RAD-16 | Endpoint sin bodies no llama ApiBody.create", async () => {
    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    });

    expect(global.ApiBody.create).not.toHaveBeenCalled();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe("registrarApiDocumentation — Validación de endpoints", () => {

  beforeEach(setupDefaultMocks);

  it("RAD-17 | Endpoint sin path es saltado (no llama ApiEndpoint.create)", async () => {
    const endpointSinPath = { method: "GET", description: "sin ruta" };

    const result = await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [endpointSinPath], updateExisting: false,
    });

    expect(global.ApiEndpoint.create).not.toHaveBeenCalled();
    expect(result.stats.totalEndpoints).toBe(0);
  });

  it("RAD-18 | Endpoint sin method es saltado", async () => {
    const endpointSinMethod = { path: "/users", description: "sin método" };

    const result = await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [endpointSinMethod], updateExisting: false,
    });

    expect(global.ApiEndpoint.create).not.toHaveBeenCalled();
  });

  it("RAD-19 | Método HTTP inválido es saltado", async () => {
    const endpointMetodoInvalido = { path: "/users", method: "INVALID" };

    const result = await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [endpointMetodoInvalido], updateExisting: false,
    });

    expect(global.ApiEndpoint.create).not.toHaveBeenCalled();
    expect(result.stats.totalEndpoints).toBe(0);
  });

  it("RAD-20 | Método en minúsculas se normaliza a mayúsculas", async () => {
    const endpointMinusculas = { ...SIMPLE_ENDPOINT, method: "get" };

    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [endpointMinusculas], updateExisting: false,
    });

    const createArgs = global.ApiEndpoint.create.mock.calls[0][0];
    expect(createArgs.method).toBe("GET");
  });

  it("RAD-21 | Response sin status_code es saltada", async () => {
    const endpointRespSinCodigo = {
      ...SIMPLE_ENDPOINT,
      responses: [{ content_type: "application/json" }], // sin status_code
    };

    await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [endpointRespSinCodigo], updateExisting: false,
    });

    expect(global.ApiResponse.create).not.toHaveBeenCalled();
  });

  it("RAD-22 | Array vacío de endpoints retorna totalEndpoints=0", async () => {
    const result = await callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [], updateExisting: false,
    });

    expect(result.stats.totalEndpoints).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe("registrarApiDocumentation — Error Path", () => {

  beforeEach(setupDefaultMocks);

  it("RAD-23 | API no encontrada → lanza error con code E_API_NOT_FOUND", async () => {
    global.Api.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(null),
    });

    await expect(callHelper({
      apiId: "inexistente", versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    })).rejects.toMatchObject({ code: "E_API_NOT_FOUND" });
  });

  it("RAD-24 | Versión ya existe con updateExisting=false → lanza E_VERSION_EXISTS", async () => {
    global.ApiVersion.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(MOCK_API_VERSION),
    });

    await expect(callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    })).rejects.toMatchObject({ code: "E_VERSION_EXISTS" });
  });

  it("RAD-25 | Error de BD en ApiEndpoint.create → lanza E_REGISTRAR_API_DOCUMENTATION", async () => {
    global.ApiEndpoint.create.mockReturnValue({
      fetch: jest.fn().mockReturnValue({
        usingConnection: jest.fn().mockRejectedValue(new Error("DB write fail")),
      }),
    });

    await expect(callHelper({
      apiId: VALID_API_ID, versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    })).rejects.toMatchObject({ code: "E_REGISTRAR_API_DOCUMENTATION" });
  });

  it("RAD-26 | Cualquier error inesperado registra en sails.log.error", async () => {
    global.Api.findOne.mockReturnValue({
      usingConnection: jest.fn().mockRejectedValue(new Error("DB error")),
    });

    try {
      await callHelper({
        apiId: VALID_API_ID, versionName: VALID_VERSION,
        endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
      });
    } catch (_) { /* esperado */ }

    expect(global.sails.log.error).toHaveBeenCalledTimes(1);
  });

  it("RAD-27 | E_API_NOT_FOUND se propaga sin envolverse en E_REGISTRAR_API_DOCUMENTATION", async () => {
    global.Api.findOne.mockReturnValue({
      usingConnection: jest.fn().mockResolvedValue(null),
    });

    await expect(callHelper({
      apiId: "inexistente", versionName: VALID_VERSION,
      endpoints: [SIMPLE_ENDPOINT], updateExisting: false,
    })).rejects.toMatchObject({ code: "E_API_NOT_FOUND" });
  });

});
