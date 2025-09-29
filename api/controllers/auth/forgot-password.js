module.exports = {
  friendlyName: "Forgot Password",

  description: "Controller action for requesting a password reset.",

  inputs: {
    email: {
      description: "The email of the user requesting password reset.",
      type: "string",
      required: true,
    },
  },

  exits: {
    success: {
      description: "Password reset email sent (if user exists).",
      responseType: "okResponse",
    },
    errorGeneral: {
      description: "Error sending reset email.",
      responseType: "nokResponse",
    },
    badRequest: {
      description: "Bad request.",
      responseType: "badRequest",
    },
  },

  fn: async function ({ email }, exits) {
    sails.log.verbose("\n--------> Controller de forgot-password\n\n");

    try {
      const user = await User.findOne({ email: email.toLowerCase() });

      // Para no revelar si existe o no el usuario, respondemos igual siempre
      if (!user) {
        return exits.success({
          mensaje:
            "If the email exists, a password reset link will be sent shortly.",
          data: {},
        });
      }

      // Generar token y expiración (1 hora)
      const token = await sails.helpers.strings.random("url-friendly");
      const expiresAt = Date.now() + 1000 * 60 * 60;

      await User.updateOne({ id: user.id }).set({
        password_reset_token: token,
        password_reset_token_expired_at: expiresAt,
      });

      // Aquí podrías enviar el correo con tu helper de email
      // await sails.helpers.email.sendResetPassword.with({ email: user.email, token })

      return exits.success({
        mensaje:
          "If the email exists, a password reset link will be sent shortly.",
        data: {
          token, // Devolver token sólo en desarrollo para pruebas
        },
      });
    } catch (error) {
      sails.log.error("Error in forgot-password:", error);

      if (error.name === "UsageError") {
        return exits.badRequest(error.message);
      } else {
        return exits.errorGeneral(
          "Ocurrió un error al intentar solicitar el reseteo de contraseña. Intenta nuevamente."
        );
      }
    }
  },
};
