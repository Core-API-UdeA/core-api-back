module.exports = {
  friendlyName: "Consultar Transacción",

  description: "Obtiene los detalles de una transacción específica",

  inputs: {
    transactionId: {
      type: "string",
      required: true,
      description: "UUID de la transacción"
    }
  },

  exits: {
    success: {
      description: "Transacción obtenida exitosamente",
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
    forbidden: {
      description: "No tienes permiso para ver esta transacción",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error al obtener transacción",
      responseType: "nokResponse"
    }
  },

  fn: async function ({ transactionId }, exits) {
    sails.log.verbose("-----> Controller: Consultar Transacción");

    try {
      const userId = this.req.decoded.sub;

      if (!userId) {
        return exits.unauthorized({
          mensaje: "Debes iniciar sesión"
        });
      }

      // Buscar la transacción
      const transaccion = await ApiTransaction.findOne({ id: transactionId })
        .populate('user_id')
        .populate('api_id')
        .populate('plan_id')
        .populate('subscription_id');

      if (!transaccion) {
        return exits.notFound({
          mensaje: "Transacción no encontrada"
        });
      }

      // Verificar que el usuario sea el dueño de la transacción
      if (transaccion.user_id.id !== userId) {
        return exits.forbidden({
          mensaje: "No tienes permiso para ver esta transacción"
        });
      }

      // Formatear respuesta con todos los detalles
      const transaccionDetallada = {
        id: transaccion.id,

        // Información de la API y Plan
        api: {
          id: transaccion.api_id?.id,
          title: transaccion.api_id?.title,
          type: transaccion.api_id?.type
        },
        plan: {
          id: transaccion.plan_id?.id,
          name: transaccion.plan_id?.name,
          billing_cycle: transaccion.plan_id?.billing_cycle
        },

        // Información de la transacción
        transaction_type: transaccion.transaction_type,
        amount: transaccion.amount,
        tax_amount: transaccion.tax_amount,
        total_amount: transaccion.total_amount,
        currency: transaccion.currency,
        platform_fee: transaccion.platform_fee,
        owner_payout: transaccion.owner_payout,

        // Estado del pago
        payment_status: transaccion.payment_status,
        payment_provider: transaccion.payment_provider,
        payment_provider_transaction_id: transaccion.payment_provider_transaction_id,
        payment_provider_checkout_id: transaccion.payment_provider_checkout_id,

        // Suscripción asociada
        subscription_id: transaccion.subscription_id?.id,
        subscription_status: transaccion.subscription_id?.status,
        api_key: transaccion.subscription_id?.api_key,

        // Metadatos
        description: transaccion.description,
        metadata: transaccion.metadata,
        payment_metadata: transaccion.payment_metadata,

        // Fechas
        transaction_date: transaccion.transaction_date,
        completed_at: transaccion.completed_at,
        refunded_at: transaccion.refunded_at,
        expires_at: transaccion.expires_at,
        created_at: transaccion.created_at,
        updated_at: transaccion.updated_at
      };

      return exits.success({
        mensaje: "Transacción obtenida exitosamente",
        data: transaccionDetallada
      });

    } catch (error) {
      sails.log.error("Error al consultar transacción:", error);
      return exits.errorGeneral({
        mensaje: error.message || "Error al consultar transacción"
      });
    }
  }
};
