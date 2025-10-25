module.exports = {
  friendlyName: "GitHub Login",

  description: "Autenticación de usuario mediante GitHub OAuth.",

  inputs: {
    code: {
      type: "string",
      required: true,
      description: "Código temporal devuelto por GitHub tras la autorización.",
    },
  },

  exits: {
    success: {
      description: "Usuario autenticado correctamente mediante GitHub.",
      responseType: "okResponse",
    },
    errorGeneral: {
      description: "Error al autenticar con GitHub.",
      responseType: "nokResponse",
    },
    badRequest: {
      description: "Petición inválida.",
      responseType: "badRequest",
    },
  },

  fn: async function ({ code }, exits) {
    try {
      sails.log.verbose("\n--------> Iniciando login con GitHub\n");

      // Verificar el código y obtener la información del usuario desde el helper
      const githubUser = await sails.helpers.auth.verifyGithubCode.with({
        code,
      });

      // Buscar usuario existente o crear uno nuevo
      let user = await User.findOne({ email: githubUser.email });

      if (!user) {
        const normalizedUsername =
          await sails.helpers.util.normalizeUsername.with({
            name: githubUser.login,
          });
        user = await User.create({
          email: githubUser.email,
          username: normalizedUsername,
          estado: "Confirmed",
          password: "github-auth",
        }).fetch();
      }

      // Crear el payload para el JWT
      const payload = {
        user: user,
        rol: user.rol,
      };

      // Generar token JWT interno
      const token = await sails.helpers.auth.generateJwtToken.with({
        subject: payload,
      });

      return exits.success({
        mensaje: "Login con GitHub exitoso",
        data: { user, token },
      });
    } catch (error) {
      sails.log.error("Error en login con GitHub:", error);
      return exits.errorGeneral("No se pudo autenticar con GitHub");
    }
  },
};
