const flaverr = require("flaverr");

module.exports = {
  friendlyName: "normalizeUsername",

  description: "Normaliza un nombre de usuario eliminando espacios y caracteres no válidos, con límite de 60 caracteres sin cortar palabras.",

  inputs: {
    name: {
      type: "string",
      required: true,
      description: "Nombre completo a normalizar.",
    },
  },

  fn: async function (inputs) {
    try {
      let username = inputs.name.trim().toLowerCase();

      username = username
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ñ/g, "n")
        .replace(/[^a-z0-9\s]/g, "");

      username = username.replace(/\s+/g, ".");

      username = username.replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");

      if (username.length > 60) {
        const cutoff = username.substring(0, 60);
        const lastDot = cutoff.lastIndexOf(".");
        if (lastDot > 0) {
          username = cutoff.substring(0, lastDot);
        } else {
          username = cutoff;
        }
      }

      return username;
    } catch (error) {
      sails.log.error("Error normalizando username:", error.message);
      throw flaverr(
        { code: "USERNAME_NORMALIZATION_FAILED", name: "UsernameError" },
        error
      );
    }
  },
};
