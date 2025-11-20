// api/controllers/suscripciones/cancelar-suscripcion.js
module.exports = {
  friendlyName: "Cancelar Suscripción",

  description: "Cancela una suscripción activa del usuario",

  inputs: {
    subscriptionId: {
      type: "string",
      required: true,
      description: "UUID de la suscripción a cancelar"
    },
    reason: {
      type: "string",
      required: false,
      description: "Motivo de la cancelación"
    }
  },

  exits: {
    success: {
      description: "Suscripción cancelada exitosamente",
      responseType: "okResponse"
    },
    unauthorized: {
      description: "Usuario no autenticado",
      responseType: "nokResponse"
    },
    notFound: {
      description: "Suscripción no encontrada",
      responseType: "nokResponse"
    },
    alreadyCancelled: {
      description: "Suscripción ya está cancelada",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error al cancelar suscripción",
      responseType: "nokResponse"
    }
  },

  fn: async function ({ subscriptionId, reason }, exits) {
    sails.log.verbose("-----> Controller: Cancelar Suscripción");

    try {
      // Verificar autenticación
      const userId = this.req.decoded.sub

      if (!userId) {
        return exits.unauthorized({
          mensaje: "Debes iniciar sesión para cancelar suscripciones"
        });
      }

      // Buscar la suscripción
      const subscription = await ApiSubscription.findOne({
        id: subscriptionId,
        user_id: userId // Solo puede cancelar sus propias suscripciones
      });

      if (!subscription) {
        return exits.notFound({
          mensaje: "Suscripción no encontrada"
        });
      }

      // Verificar que no esté ya cancelada
      if (subscription.status === "cancelled") {
        return exits.alreadyCancelled({
          mensaje: "Esta suscripción ya está cancelada"
        });
      }

      // Cancelar la suscripción
      const cancelledSubscription = await ApiSubscription.updateOne({
        id: subscriptionId
      })
      .set({
        status: "cancelled",
        cancelled_at: new Date(),
        auto_renew: false,
        metadata: {
          ...subscription.metadata,
          cancellation_reason: reason || "No especificado"
        }
      });

      sails.log.verbose(`Suscripción cancelada: ${subscriptionId}`);

      return exits.success({
        mensaje: "Suscripción cancelada exitosamente",
        data: cancelledSubscription
      });

    } catch (error) {
      sails.log.error("Error al cancelar suscripción:", error);

      return exits.errorGeneral({
        mensaje: error.message || "Error al cancelar la suscripción"
      });
    }
  }
};
