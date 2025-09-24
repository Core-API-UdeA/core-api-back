module.exports = {
  friendlyName: "Google Login",

  inputs: {
    idToken: { type: "string", required: true },
  },

  exits: {
    success: {
      description: "User successfully logged in.",
      responseType: "okResponse",
    },
    errorGeneral: {
      description: "Error logging in user.",
      responseType: "nokResponse",
    },
    badRequest: {
      description: "Bad request.",
      responseType: "badRequest",
    },
  },

  fn: async function ({ idToken }, exits) {
    try {
      const googleUser = await sails.helpers.auth.verifyGoogleToken.with({
        idToken,
      });

      let user = await User.findOne({ email: googleUser.email });

      if (!user) {
        user = await User.create({
          email: googleUser.email,
          username: googleUser.name,
          estado: "Confirmed",
          password: "google-auth",
        }).fetch();
      }

      const payload = {
        user: user,
        rol: user.rol,
      };

      const token = await sails.helpers.auth.generateJwtToken.with({
        subject: payload,
      });

      return exits.success({
        mensaje: "Login con Google exitoso",
        data: { user, token },
      });
    } catch (e) {
      sails.log.error("Error Google login:", e);
      return exits.errorGeneral("No se pudo autenticar con Google");
    }
  },
};
