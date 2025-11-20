// api/controllers/suscripciones/listar-suscripciones.js
module.exports = {
  friendlyName: "Listar Mis Suscripciones",

  description: "Lista las suscripciones del usuario autenticado",

  inputs: {
    status: {
      type: "string",
      isIn: ["active", "cancelled", "expired", "suspended", "trial"],
      required: false,
      description: "Filtrar por estado"
    }
  },

  exits: {
    success: {
      description: "Suscripciones encontradas",
      responseType: "okResponse"
    },
    unauthorized: {
      description: "Usuario no autenticado",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error al listar suscripciones",
      responseType: "nokResponse"
    }
  },

  fn: async function ({ status }, exits) {
    sails.log.verbose("-----> Controller: Listar Mis Suscripciones");

    try {
      // Verificar autenticación
      const userId = this.req.decoded.sub

      if (!userId) {
        return exits.unauthorized({
          mensaje: "Debes iniciar sesión para ver tus suscripciones"
        });
      }

      // Construir query
      const where = { user_id: userId };

      if (status) {
        where.status = status;
      }

      // Obtener suscripciones
      const subscriptions = await ApiSubscription.find({ where })
        .populate("api_id")
        .populate("plan_id")
        .sort("created_at DESC");

      return exits.success({
        mensaje: "Suscripciones encontradas",
        data: subscriptions
      });

    } catch (error) {
      sails.log.error("Error al listar suscripciones:", error);

      return exits.errorGeneral({
        mensaje: error.message || "Error al listar suscripciones"
      });
    }
  }
};
