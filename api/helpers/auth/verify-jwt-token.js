const jwt = require("jsonwebtoken");
const flaverr = require("flaverr");

module.exports = {
  friendlyName: "Verify JWT Token",

  description: "Verifies the provided JWT token and decodes it if valid.",

  inputs: {
    token: {
      description: "Token to validate.",
      type: "string",
      required: true,
    },
  },

  exits: {},

  fn: async function ({ token }) {
    sails.log.verbose("\n--------> Helper de validacion de token\n\n");

    const secret = sails.config.jwtSecret || process.env.JWT_SECRET;

    try {
      const decoded = await jwt.verify(token, secret);
      sails.log.debug("\nDecoded Token:", decoded);
      return decoded;
    } catch (err) {
      sails.log.error("Token verification error:", err);

      if (err.name === "TokenExpiredError") {
        throw flaverr(
          {
            code: "E_AUTH_TOKEN_EXPIRED",
            name: "expired",
          },
          new Error("Session timed out, please login again")
        );
      } else {
        throw flaverr(
          {
            code: "E_AUTH_BAD_TOKEN",
            name: "badToken",
          },
          new Error("Invalid token, please login again")
        );
      }
    }
  },
};