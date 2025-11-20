// api/controllers/pagos/consultar-transaccion.js
module.exports = {
  friendlyName: "Consultar Transacción",

  description: "Consulta el estado de una transacción",

  inputs: {
    transactionId: {
      type: "string",
      required: true,
      description: "UUID de la transacción"
    }
  },

  exits: {
    success: {
      description: "Transacción encontrada",
      responseType: "okResponse"
    },
    unauthorized: {
      description: "Usuario no autenticado",
      responseType: "nokResponse"
    },
    notFound: {
      description: "Transacción no encontrada",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error al consultar transacción",
      responseType: "nokResponse"
    }
  },

  fn: async function ({ transactionId }, exits) {
    sails.log.verbose("-----> Controller: Consultar Transacción");

    try {
      // Verificar autenticación
      const userId = this.req.decoded.sub

      if (!userId) {
        return exits.unauthorized({
          mensaje: "Debes iniciar sesión para consultar transacciones"
        });
      }

      // Buscar la transacción
      const transaction = await ApiTransaction.findOne({
        id: transactionId,
        user_id: userId // Solo puede ver sus propias transacciones
      })
      .populate("api_id")
      .populate("plan_id")
      .populate("subscription_id");

      if (!transaction) {
        return exits.notFound({
          mensaje: "Transacción no encontrada"
        });
      }

      return exits.success({
        mensaje: "Transacción encontrada",
        data: transaction
      });

    } catch (error) {
      sails.log.error("Error al consultar transacción:", error);

      return exits.errorGeneral({
        mensaje: error.message || "Error al consultar la transacción"
      });
    }
  }
};
