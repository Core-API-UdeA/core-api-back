const axios = require("axios");
const flaverr = require("flaverr");

module.exports = {
  friendlyName: "Verify GitHub Code",

  description: "Intercambia el código de GitHub por un access_token y obtiene los datos del usuario.",

  inputs: {
    code: { type: "string", required: true },
  },

  fn: async function ({ code }) {
    try {
      sails.log.verbose("\n--------> Helper de verificación de código de GitHub\n");

      // Intercambiar el código por el access_token
      const tokenResponse = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: sails.config.auth.githubClientId,
          client_secret: sails.config.auth.githubClientSecret,
          code,
        },
        { headers: { Accept: "application/json" } }
      );

      const accessToken = tokenResponse.data.access_token;

      if (!accessToken) {
        throw new Error("No se obtuvo un access_token de GitHub");
      }

      // Obtener datos básicos del usuario
      const userResponse = await axios.get("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Obtener correo del usuario (GitHub separa esto)
      const emailResponse = await axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const primaryEmail = emailResponse.data.find((e) => e.primary)?.email;

      return {
        email: primaryEmail,
        name: userResponse.data.name,
        login: userResponse.data.login,
        avatar_url: userResponse.data.avatar_url,
      };
    } catch (error) {
      sails.log.error("Error verificando código de GitHub:", error.response?.data || error.message);
      throw flaverr(
        {
          code: "E_GITHUB_CODE_INVALID",
          name: "invalidGithubCode",
        },
        new Error("Código de GitHub inválido o expirado")
      );
    }
  },
};
