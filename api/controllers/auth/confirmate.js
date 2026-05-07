module.exports = {
  friendlyName: "",

  description: "",

  inputs: {
    emailConfirmationToken: {
      type: "string",
      required: true,
      description: "The email confirmation token.",
    },
  },

  exits: {
    success: {
      description: "The requesting user agent has been successfully logged in.",
      responseType: "okResponse",
    },

    errorGeneral: {
      description: "Error logging in user.",
      responseType: "nokResponse",
    },
  },

  fn: async function ({ emailConfirmationToken }, exits) {
    try {
      sails.log.verbose("\n--------> Controller de confirmación de correo\n\n");

      const user = await User.findOne({
        emailConfirmationToken: emailConfirmationToken,
      });

      if (!user) {
        throw new Error("userNotFound");
      }

      const currentTime = Date.now();
      const tokenExpiresAt = user.emailConfirmationTokenExpiresAt;

      if (tokenExpiresAt < currentTime) {
        throw new Error("tokenExpired");
      }

      const maxTokenDuration = sails.config.register.emailConfirmationTokenTTL;
      const tokenAge = currentTime - (tokenExpiresAt - maxTokenDuration);

      if (tokenAge > maxTokenDuration) {
        throw new Error("tokenExpired");
      }

      await User.updateOne({ id: user.id }).set({
        emailConfirmationToken: null,
        emailConfirmationTokenExpiresAt: null,
        estado: "Confirmed",
      });

      const payload = {
        user: user,
        rol: user.rol,
      };

      const token = await sails.helpers.auth.generateJwtToken.with({
        subject: payload,
      });

      await sails.helpers.auth.updateUserLastSeen.with({
        userId: user.id,
      });

      return exits.success({
        mensaje: `${user.email} has been confirmed`,
        data: {
          user,
          token: token,
        },
      });
    } catch (error) {
      sails.log.error("Error en fetch:", error);
      if (error.message === "userNotFound") {
        return exits.errorGeneral("User not found");
      }
      if (error.message === "tokenExpired") {
        return exits.errorGeneral("Token expired");
      }
      return exits.errorGeneral("Error logging in user");
    }
  },
};
