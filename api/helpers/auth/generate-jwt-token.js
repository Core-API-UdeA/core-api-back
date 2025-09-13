const jwt = require("jsonwebtoken");
const flaverr = require("flaverr");

module.exports = {
  friendlyName: "Generate JWT Token",

  description: "Generates a JWT token for the provided subject.",

  inputs: {
    subject: {
      description: "Object with user and roles to encode in the token.",
      type: "ref",
      required: true,
    },
  },

  exits: {},

  fn: async function ({ subject }) {
    sails.log.verbose("\n--------> Helper de generación de token\n");

    const secret = sails.config.jwtSecret || process.env.JWT_SECRET;
    const expiresIn = sails.config.jwtExpiresIn || "4h";
    const issuer = sails.config.issuer || "core-api-auth";

    try {
      const payload = {
        sub: subject.user?.id || subject.id,
        iss: issuer,
        user: subject.user || subject,
        rol: subject.rol,
      };

      const token = jwt.sign(payload, secret, { expiresIn });

      sails.log.debug("Token generado con éxito");
      return token;
    } catch (err) {
      sails.log.error("Error generando el token:", err);

      throw flaverr(
        {
          code: "E_AUTH_TOKEN_GENERATION_FAILED",
          name: "tokenGenerationFailed",
        },
        new Error("Failed to generate token, please try again")
      );
    }
  },
};