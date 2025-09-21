module.exports = {
  friendlyName: 'Register',

  description: 'Controller action for registering a new user.',

  inputs: {
    email: {
      description: 'The email of the user to register.',
      type: 'string',
      required: true,
    },
    username: {
      description: 'The username of the user to register.',
      type: 'string',
      required: true,
    },
    password: {
      description: 'The password of the user to register.',
      type: 'string',
      required: true,
    },
  },

  exits: {
    success: {
      description: 'User successfully registered.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Error registering user.',
      responseType: 'nokResponse',
    },
    badRequest: {
      description: 'Bad request.',
      responseType: 'badRequest',
    },
  },

  fn: async function ({ email, username, password }, exits) {
    sails.log.verbose('\n--------> Controller de register\n\n');

    try {
      // Normalizamos email y username
      const normalizedEmail = email.toLowerCase().trim();
      const normalizedUsername = username.trim();

      // Validar si ya existe email
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return exits.errorGeneral('El correo ya está registrado');
      }

      // Validar si ya existe username
      const existingUsername = await User.findOne({ username: normalizedUsername });
      if (existingUsername) {
        return exits.errorGeneral('El nombre de usuario ya está en uso');
      }

      // Crear hash de la contraseña
      const hashedPassword = await sails.helpers.passwords.hashPassword(password);

      // Crear el usuario usando defaults del modelo (estado y rol)
      const newUser = await User.create({
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
        estado: 'Confirmed'
      }).fetch();

      // Generar token igual que en login
      const payload = {
        user: newUser,
        rol: newUser.rol,
      };

      const token = await sails.helpers.auth.generateJwtToken.with({
        subject: payload,
      });

      // Actualizar last seen
      await sails.helpers.auth.updateUserLastSeen.with({
        userId: newUser.id,
      });

      return exits.success({
        mensaje: 'Usuario registrado correctamente',
        data: {
          user: newUser,
          token: token,
        },
      });
    } catch (error) {
      sails.log.error('Error registering user:', error);

      if (error.name === 'UsageError') {
        return exits.badRequest(error.message);
      } else {
        return exits.errorGeneral(
          'Ocurrió un error al intentar registrar. Intenta nuevamente.'
        );
      }
    }
  },
};
