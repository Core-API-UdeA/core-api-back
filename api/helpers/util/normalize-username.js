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

      // Normalizar tildes y caracteres especiales
      username = username
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")  // NOSONAR — rango Unicode fijo, sin backtracking
        .replace(/ñ/g, "n")               // NOSONAR — literal simple
        .replace(/[^a-z0-9\s]/g, "");    // NOSONAR — clase de caracteres simple

      // Reemplazar espacios por puntos — sin regex vulnerable
      username = username
        .split(/\s+/)
        .filter(Boolean)
        .join(".");

      // Eliminar puntos al inicio y al final — sin regex
      while (username.startsWith(".")) username = username.slice(1);
      while (username.endsWith(".")) username = username.slice(0, -1);

      // Límite de 60 caracteres sin cortar palabras
      if (username.length > 60) {
        const cutoff = username.substring(0, 60);
        const lastDot = cutoff.lastIndexOf(".");
        username = lastDot > 0 ? cutoff.substring(0, lastDot) : cutoff;
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
