/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",

  testMatch: ["**/__tests__/unit/**/*.test.js"],

  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],

  collectCoverageFrom: [
    "api/helpers/util/normalize-username.js",
    "api/helpers/auth/generate-jwt-token.js",
    "api/helpers/auth/verify-jwt-token.js",
    "api/helpers/catalogo/registrar-valoracion-favorito.js",
    "api/policies/auth/validate-register-params.js",
  ],

  testTimeout: 10000,

  verbose: true,
};
