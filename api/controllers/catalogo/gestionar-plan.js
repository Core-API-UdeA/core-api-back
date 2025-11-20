// api/controllers/catalogo/gestionar-plan.js
module.exports = {
  friendlyName: "Gestionar Plan de API",

  description: "Crea o actualiza un plan de una API (solo owners)",

  inputs: {
    planId: {
      type: "string",
      required: false,
      description: "UUID del plan (para actualizar, opcional)"
    },
    apiId: {
      type: "string",
      required: true,
      description: "UUID de la API"
    },
    planData: {
      type: "json",
      required: true,
      description: "Datos del plan"
    }
  },

  exits: {
    success: {
      description: "Plan gestionado exitosamente",
      responseType: "okResponse"
    },
    unauthorized: {
      description: "Usuario no autorizado",
      responseType: "nokResponse"
    },
    invalidData: {
      description: "Datos inválidos",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error inesperado",
      responseType: "nokResponse"
    }
  },

  fn: async function ({ planId, apiId, planData }, exits) {
    sails.log.verbose("-----> Controller: Gestionar Plan de API");

    try {
      // Verificar autenticación
      const userId = this.req.decoded.sub

      if (!userId) {
        return exits.unauthorized({
          mensaje: "Debes iniciar sesión para gestionar planes"
        });
      }

      // Gestionar plan
      const result = await sails.helpers.catalogo.gestionarPlan.with({
        planId,
        apiId,
        ownerId: userId,
        planData
      });

      return exits.success({
        mensaje: result.message,
        data: result.plan
      });

    } catch (error) {
      sails.log.error("Error al gestionar plan:", error);

      if (error.code === "unauthorized") {
        return exits.unauthorized({
          mensaje: error.message || "No tienes permisos para realizar esta acción"
        });
      }

      if (error.code === "invalidData") {
        return exits.invalidData({
          mensaje: error.message || "Datos del plan inválidos"
        });
      }

      return exits.errorGeneral({
        mensaje: error.message || "Error al gestionar el plan"
      });
    }
  }
};
