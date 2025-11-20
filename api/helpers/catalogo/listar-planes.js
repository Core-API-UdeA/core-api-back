// api/helpers/catalogo/listar-planes.js
module.exports = {
  friendlyName: "Listar Planes de API",

  description: "Obtiene todos los planes disponibles de una API específica",

  inputs: {
    apiId: {
      type: "string",
      required: true,
      description: "UUID de la API"
    },
    includeInactive: {
      type: "boolean",
      defaultsTo: false,
      description: "Si incluir planes inactivos"
    }
  },

  exits: {
    success: {
      description: "Planes obtenidos exitosamente"
    },
    notFound: {
      description: "API no encontrada"
    }
  },

  fn: async function ({ apiId, includeInactive }) {
    sails.log.verbose("-----> Helper: Listar Planes de API");
    const flaverr = require("flaverr");

    try {
      // Verificar que la API exista
      const api = await Api.findOne({ id: apiId });

      if (!api) {
        throw flaverr(
          { code: "notFound" },
          new Error("API no encontrada")
        );
      }

      // Construir query
      const where = { api_id: apiId };

      if (!includeInactive) {
        where.is_active = true;
      }

      // Obtener planes ordenados por precio
      const plans = await ApiPlan.find({ where })
        .sort('price ASC');

      sails.log.verbose(`Encontrados ${plans.length} planes para la API ${apiId}`);

      return plans;

    } catch (error) {
      sails.log.error("Error al listar planes:", error);

      if (error.code === "notFound") {
        throw error;
      }

      throw flaverr(
        { code: "E_LISTAR_PLANES" },
        new Error(`Error al listar planes: ${error.message}`)
      );
    }
  }
};
