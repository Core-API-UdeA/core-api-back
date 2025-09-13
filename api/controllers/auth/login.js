module.exports = {
  friendlyName: "Login",

  description: "Controller action for logging in a user.",

  inputs: {
    email: {
      description: "The email of the user to log in.",
      type: "string",
      required: true,
    },
    password: {
      description: "The password of the user to log in.",
      type: "string",
      required: true,
    },
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

  fn: async function ({ email, password }, exits) {
    sails.log.verbose("\n--------> Controller de login\n\n");

    try {
      const user = await User.findOne({ email: email.toLowerCase() });

      sails.log(`Usuario encontrado: ${user ? user.email : "No encontrado"}`);

      if (!user) {
        return exits.errorGeneral("Correo o contraseña inválidos");
      }

      if (user.estado !== "Confirmed") {
        return exits.errorGeneral("El usuario no está confirmado");
      }

      await sails.helpers.passwords.checkPassword(password, user.password);

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
        mensaje: "Usuario autenticado correctamente",
        data: {
          user: user,
          token: token,
        },
      });
    } catch (error) {
      sails.log.error("Error logging in user:", error);

      if (error.name === "UsageError") {
        return exits.badRequest(error.message);
      } else {
        return exits.errorGeneral(
          "Error autenticando usuario: " + error.message
        );
      }
    }
  },
};
