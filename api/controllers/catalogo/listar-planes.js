// api/controllers/catalogo/listar-planes.js
module.exports = {
  friendlyName: "Listar Planes de API",

  description: "Obtiene todos los planes disponibles de una API",

  inputs: {
    apiId: {
      type: "string",
      required: true,
      description: "UUID de la API"
    },
    includeInactive: {
      type: "boolean",
      defaultsTo: false,
      description: "Incluir planes inactivos (solo para owners)"
    }
  },

  exits: {
    success: {
      description: "Planes obtenidos exitosamente",
      responseType: "okResponse"
    },
    notFound: {
      description: "API no encontrada",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error inesperado al obtener planes",
      responseType: "nokResponse"
    }
  },

  fn: async function ({ apiId, includeInactive }, exits) {
    sails.log.verbose("-----> Controller: Listar Planes de API");

    try {
      // Si pide incluir inactivos, verificar que sea el owner
      let shouldIncludeInactive = false;

      if (includeInactive) {
        const userId = this.req.decoded.sub

        if (userId) {
          const api = await Api.findOne({ id: apiId });

          // Solo el owner puede ver planes inactivos
          if (api && api.owner_id === userId) {
            shouldIncludeInactive = true;
          }
        }
      }

      // Obtener planes
      const plans = await sails.helpers.catalogo.listarPlanes.with({
        apiId,
        includeInactive: shouldIncludeInactive
      });

      return exits.success({
        mensaje: "Planes obtenidos exitosamente",
        data: plans
      });

    } catch (error) {
      sails.log.error("Error al listar planes:", error);

      if (error.code === "notFound") {
        return exits.notFound({
          mensaje: "API no encontrada"
        });
      }

      return exits.errorGeneral({
        mensaje: error.message || "Error al obtener los planes"
      });
    }
  }
};
