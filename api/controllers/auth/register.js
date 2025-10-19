module.exports = {
  friendlyName: "Register",

  description: "Controller action for registering a new user.",

  inputs: {
    email: {
      description: "The email of the user to register.",
      type: "string",
      required: true,
    },
    username: {
      description: "The username of the user to register.",
      type: "string",
      required: true,
    },
    password: {
      description: "The password of the user to register.",
      type: "string",
      required: true,
    },
  },

  exits: {
    success: {
      description: "User successfully registered.",
      responseType: "okResponse",
    },
    errorGeneral: {
      description: "Error registering user.",
      responseType: "nokResponse",
    },
    badRequest: {
      description: "Bad request.",
      responseType: "badRequest",
    },
  },

  fn: async function ({ email, username, password }, exits) {
    sails.log.verbose("\n--------> Controller de register\n\n");

    try {
      // Normalizamos email y username
      const normalizedEmail = email.toLowerCase().trim();
      const normalizedUsername = username.trim();

      // Validar si ya existe email
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return exits.errorGeneral("The email is already registered");
      }

      // Validar si ya existe username
      const existingUsername = await User.findOne({
        username: normalizedUsername,
      });
      if (existingUsername) {
        return exits.errorGeneral("The username is already in use");
      }

      // Crear hash de la contraseña
      const hashedPassword = await sails.helpers.passwords.hashPassword(
        password
      );

      // Crear el usuario usando defaults del modelo (estado y rol)
      const newUser = await User.create({
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
        estado: "Unconfirmed",
      }).fetch();

      const tokenConfirmation = await sails.helpers.strings.random(
        "url-friendly"
      );

      await User.updateOne({ id: newUser.id }).set({
        emailConfirmationToken: tokenConfirmation,
        emailConfirmationTokenExpiresAt:
          Date.now() + sails.config.register.emailConfirmationTokenTTL,
      });

      await sails.helpers.auth.sendConfirmationEmail.with({
        to: normalizedEmail,
        name: normalizedUsername,
        confirmationUrl:
          sails.config.register.urlConfirmacion + tokenConfirmation,
      });

      return exits.success({
        mensaje:
          "Usuario registrado exitosamente. Por favor, confirme su correo electrónico.",
        data: {},
      });
    } catch (error) {
      sails.log.error("Error registering user:", error);

      if (error.name === "UsageError") {
        return exits.badRequest(error.message);
      } else {
        return exits.errorGeneral(
          "Ocurrió un error al intentar registrar. Intenta nuevamente."
        );
      }
    }
  },
};
