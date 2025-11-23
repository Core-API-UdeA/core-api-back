module.exports = {
  friendlyName: "Mis Transacciones",

  description: "Obtiene el historial de transacciones del usuario autenticado",

  exits: {
    success: {
      description: "Transacciones obtenidas exitosamente",
      responseType: "okResponse"
    },
    unauthorized: {
      description: "Usuario no autenticado",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error al obtener transacciones",
      responseType: "nokResponse"
    }
  },

  fn: async function (inputs, exits) {
    sails.log.verbose("-----> Controller: Mis Transacciones");

    try {
      const userId = this.req.decoded.sub;

      if (!userId) {
        return exits.unauthorized({
          mensaje: "Debes iniciar sesión"
        });
      }

      // Obtener transacciones del usuario
      const transacciones = await ApiTransaction.find({
        user_id: userId
      })
      .populate('api_id')
      .populate('plan_id')
      .populate('subscription_id')
      .sort('transaction_date DESC')
      .limit(50);

      // Formatear respuesta
      const transaccionesFormateadas = transacciones.map(t => ({
        id: t.id,
        api_name: t.api_id?.title || 'API no disponible',
        api_id: t.api_id?.id,
        plan_name: t.plan_id?.name || 'Plan no disponible',
        plan_id: t.plan_id?.id,
        transaction_type: t.transaction_type,
        amount: t.amount,
        total_amount: t.total_amount,
        currency: t.currency,
        payment_status: t.payment_status,
        payment_provider: t.payment_provider,
        payment_provider_transaction_id: t.payment_provider_transaction_id,
        subscription_id: t.subscription_id?.id,
        description: t.description,
        transaction_date: t.transaction_date,
        completed_at: t.completed_at,
        created_at: t.created_at
      }));

      return exits.success({
        mensaje: "Transacciones obtenidas exitosamente",
        data: transaccionesFormateadas
      });

    } catch (error) {
      sails.log.error("Error al obtener transacciones:", error);
      return exits.errorGeneral({
        mensaje: error.message || "Error al obtener transacciones"
      });
    }
  }
};
