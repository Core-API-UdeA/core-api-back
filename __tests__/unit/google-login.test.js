// ─── google-login.test.js ─────────────────────────────────────────────────────
// Pruebas unitarias para api/controllers/auth/google-login.js
// Mockea: sails.helpers, User (modelo ORM), crypto
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => "mocked-random-hex-token-32bytes00"),
  })),
}));

// ── Mock de sails global ──────────────────────────────────────────────────────
const sailsMock = {
  log: {
    verbose: jest.fn(),
    debug:   jest.fn(),
    error:   jest.fn(),
    warn:    jest.fn(),
  },
  helpers: {
    auth: {
      verifyGoogleToken: { with: jest.fn() },
      generateJwtToken:  { with: jest.fn() },
    },
    util: {
      normalizeUsername: { with: jest.fn() },
    },
  },
};
global.sails = sailsMock;

// ── Mock del modelo User ──────────────────────────────────────────────────────
const UserMock = {
  findOne: jest.fn(),
  create:  jest.fn(),
};
global.User = UserMock;

// ── Cargar el controlador ─────────────────────────────────────────────────────
const googleLoginController = require("../../api/controllers/auth/google-login");

// ── Helpers para invocar el fn ────────────────────────────────────────────────
function buildExits() {
  return {
    success:      jest.fn(),
    errorGeneral: jest.fn(),
    badRequest:   jest.fn(),
  };
}

async function callFn(inputs, exits) {
  return googleLoginController.fn.call({}, inputs, exits);
}

// ── Datos de prueba ───────────────────────────────────────────────────────────
const GOOGLE_USER = {
  email: "test@gmail.com",
  name:  "Test User",
  sub:   "google-sub-123",
};

const DB_USER = {
  id:       "user-uuid-001",
  email:    "test@gmail.com",
  username: "test.user",
  rol:      "usuario",
  estado:   "Confirmed",
};

// ─────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();

  // Defaults felices
  sailsMock.helpers.auth.verifyGoogleToken.with.mockResolvedValue(GOOGLE_USER);
  sailsMock.helpers.auth.generateJwtToken.with.mockResolvedValue("jwt-token-abc");
  sailsMock.helpers.util.normalizeUsername.with.mockResolvedValue("test.user");

  UserMock.findOne.mockResolvedValue(DB_USER);
  UserMock.create.mockReturnValue({ fetch: jest.fn().mockResolvedValue(DB_USER) });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("googleLogin — Happy Path: usuario existente", () => {

  it("GL-01 | Usuario ya existe → exits.success con token y user", async () => {
    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(exits.success).toHaveBeenCalledTimes(1);
    const args = exits.success.mock.calls[0][0];
    expect(args.data.token).toBe("jwt-token-abc");
    expect(args.data.user).toEqual(DB_USER);
  });

  it("GL-02 | No llama User.create si el usuario ya existe", async () => {
    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(UserMock.create).not.toHaveBeenCalled();
  });

  it("GL-03 | Llama verifyGoogleToken con el idToken recibido", async () => {
    const exits = buildExits();
    await callFn({ idToken: "my-id-token" }, exits);

    expect(sailsMock.helpers.auth.verifyGoogleToken.with)
      .toHaveBeenCalledWith({ idToken: "my-id-token" });
  });

  it("GL-04 | Llama generateJwtToken con el payload correcto", async () => {
    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(sailsMock.helpers.auth.generateJwtToken.with)
      .toHaveBeenCalledWith({
        subject: { user: DB_USER, rol: DB_USER.rol },
      });
  });

  it("GL-05 | El mensaje de respuesta indica login con Google exitoso", async () => {
    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    const args = exits.success.mock.calls[0][0];
    expect(args.mensaje).toBe("Login con Google exitoso");
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe("googleLogin — Happy Path: usuario nuevo", () => {

  beforeEach(() => {
    // Simula que no existe el usuario → debe crearlo
    UserMock.findOne.mockResolvedValue(null);
  });

  it("GL-06 | Usuario nuevo → llama normalizeUsername con el nombre de Google", async () => {
    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(sailsMock.helpers.util.normalizeUsername.with)
      .toHaveBeenCalledWith({ name: GOOGLE_USER.name });
  });

  it("GL-07 | Usuario nuevo → llama User.create con datos correctos", async () => {
    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(UserMock.create).toHaveBeenCalledTimes(1);
    const createArgs = UserMock.create.mock.calls[0][0];
    expect(createArgs.email).toBe(GOOGLE_USER.email);
    expect(createArgs.username).toBe("test.user");
    expect(createArgs.estado).toBe("Confirmed");
  });

  it("GL-08 | La contraseña generada NO es el string literal 'google-auth'", async () => {
    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    const createArgs = UserMock.create.mock.calls[0][0];
    expect(createArgs.password).not.toBe("google-auth");
  });

  it("GL-09 | La contraseña generada usa crypto.randomBytes", async () => {
    const crypto = require("crypto");
    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(crypto.randomBytes).toHaveBeenCalledWith(32);
  });

  it("GL-10 | exits.success se llama con el usuario recién creado", async () => {
    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(exits.success).toHaveBeenCalledTimes(1);
    expect(exits.success.mock.calls[0][0].data.user).toEqual(DB_USER);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
describe("googleLogin — Error Path", () => {

  it("GL-11 | verifyGoogleToken falla → exits.errorGeneral", async () => {
    sailsMock.helpers.auth.verifyGoogleToken.with
      .mockRejectedValue(new Error("Token de Google inválido"));

    const exits = buildExits();
    await callFn({ idToken: "bad-token" }, exits);

    expect(exits.errorGeneral).toHaveBeenCalledTimes(1);
    expect(exits.success).not.toHaveBeenCalled();
  });

  it("GL-12 | User.findOne falla → exits.errorGeneral", async () => {
    UserMock.findOne.mockRejectedValue(new Error("DB connection error"));

    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(exits.errorGeneral).toHaveBeenCalledTimes(1);
  });

  it("GL-13 | generateJwtToken falla → exits.errorGeneral", async () => {
    sailsMock.helpers.auth.generateJwtToken.with
      .mockRejectedValue(new Error("JWT sign error"));

    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(exits.errorGeneral).toHaveBeenCalledTimes(1);
  });

  it("GL-14 | Cualquier error registra en sails.log.error", async () => {
    sailsMock.helpers.auth.verifyGoogleToken.with
      .mockRejectedValue(new Error("fallo cualquiera"));

    const exits = buildExits();
    await callFn({ idToken: "bad-token" }, exits);

    expect(sailsMock.log.error).toHaveBeenCalledTimes(1);
  });

  it("GL-15 | User.create falla (usuario nuevo) → exits.errorGeneral", async () => {
    UserMock.findOne.mockResolvedValue(null);
    UserMock.create.mockReturnValue({
      fetch: jest.fn().mockRejectedValue(new Error("DB write error")),
    });

    const exits = buildExits();
    await callFn({ idToken: "valid-google-id-token" }, exits);

    expect(exits.errorGeneral).toHaveBeenCalledTimes(1);
  });

});
