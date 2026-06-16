require("dotenv").config();

module.exports = {
  models: {
    migrate: "safe",
    cascadeOnDestroy: false,
  },

  blueprints: {
    shortcuts: false,
  },

  security: {
    cors: {
      allRoutes: true,
      allowOrigins: ["https://core-api-zeta.vercel.app"],
      allowCredentials: true,
    },
  },

  session: {
    cookie: {
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  },

  log: {
    level: "info",
  },

  http: {
    trustProxy: true,
    cache: 0,
  },

  custom: {
    baseUrl: process.env.BASE_URL,
    frontendUrl: process.env.FRONTEND_URL,
    gatewayEncryptionKey: process.env.GATEWAY_ENCRYPTION_KEY,
  },

  sockets: {
    onlyAllowOrigins: ["https://core-api-zeta.vercel.app"],
  },
};
