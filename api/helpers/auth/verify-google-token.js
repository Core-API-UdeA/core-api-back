const { OAuth2Client } = require("google-auth-library");
const flaverr = require("flaverr");

module.exports = {
  friendlyName: "Verify Google Token",

  description: "Verifica un token de Google y devuelve la info del usuario.",

  inputs: {
    idToken: { type: "string", required: true },
  },

  fn: async function ({ idToken }) {
    try {
      sails.log.verbose(
        "\n--------> Helper de verificacion de token de Google\n\n"
      );
      const client = new OAuth2Client(sails.config.auth.googleClientId);

      const ticket = await client.verifyIdToken({
        idToken,
        audience: sails.config.auth.googleClientId,
      });

      const payload = ticket.getPayload();
      return {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        sub: payload.sub,
      };
    } catch (error) {
      sails.log.error("Error verifying Google token:", error);
      throw flaverr(
        {
          code: "E_GOOGLE_TOKEN_INVALID",
          name: "invalidGoogleToken",
        },
        new Error("Invalid Google token")
      );
    }
  },
};
