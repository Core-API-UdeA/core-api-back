// api/controllers/pagos/listar-transacciones.js
module.exports = {
  friendlyName: "Listar Mis Transacciones",

  description: "Lista las transacciones del usuario autenticado",

  inputs: {
    page: {
      type: "number",
      defaultsTo: 1,
      description: "Número de página"
    },
    limit: {
      type: "number",
      defaultsTo: 10,
      description: "Cantidad de resultados por página"
    },
    status: {
      type: "string",
      isIn: ["pending", "processing", "completed", "failed", "refunded", "cancelled"],
      required: false,
      description: "Filtrar por estado"
    },
    apiId: {
      type: "string",
      required: false,
      description: "Filtrar por API específica"
    }
  },

  exits: {
    success: {
      description: "Transacciones encontradas",
      responseType: "okResponse"
    },
    unauthorized: {
      description: "Usuario no autenticado",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error al listar transacciones",
      responseType: "nokResponse"
    }
  },

  fn: async function ({ page, limit, status, apiId }, exits) {
    sails.log.verbose("-----> Controller: Listar Mis Transacciones");

    try {
      // Verificar autenticación
      const userId = this.req.decoded.sub

      if (!userId) {
        return exits.unauthorized({
          mensaje: "Debes iniciar sesión para ver tus transacciones"
        });
      }

      // Construir query
      const where = { user_id: userId };

      if (status) {
        where.payment_status = status;
      }

      if (apiId) {
        where.api_id = apiId;
      }

      // Calcular skip
      const skip = (page - 1) * limit;

      // Obtener transacciones
      const transactions = await ApiTransaction.find({
        where,
        skip,
        limit,
        sort: 'created_at DESC'
      })
      .populate("api_id")
      .populate("plan_id")
      .populate("subscription_id");

      // Contar total
      const total = await ApiTransaction.count({ where });

      return exits.success({
        mensaje: "Transacciones encontradas",
        data: {
          transactions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      sails.log.error("Error al listar transacciones:", error);

      return exits.errorGeneral({
        mensaje: error.message || "Error al listar transacciones"
      });
    }
  }
};
