// api/controllers/webhooks/mercadopago.js
module.exports = {
  friendlyName: "Webhook Mercado Pago",

  description: "Recibe y procesa notificaciones IPN de Mercado Pago",

  inputs: {
    type: {
      type: "string",
      required: false,
      description: "Tipo de notificación"
    },
    data: {
      type: "json",
      required: false,
      description: "Datos de la notificación"
    },
    id: {
      type: "string",
      required: false,
      description: "ID del recurso notificado"
    },
    topic: {
      type: "string",
      required: false,
      description: "Topic de la notificación (payment, merchant_order)"
    }
  },

  exits: {
    success: {
      description: "Webhook procesado exitosamente"
    },
    errorGeneral: {
      description: "Error al procesar webhook"
    }
  },

  fn: async function ({ type, data, id, topic }, exits) {
    sails.log.verbose("-----> Controller: Webhook Mercado Pago");
    sails.log.verbose("Datos recibidos:", { type, data, id, topic });

    try {
      // Mercado Pago puede enviar notificaciones en diferentes formatos
      // Formato 1: { type, data: { id } }
      // Formato 2: { id, topic }

      let notificationType = type || topic;
      let notificationId = data?.id || id;

      if (!notificationType || !notificationId) {
        sails.log.warn("Webhook sin tipo o ID válido");
        return exits.success(); // Retornar 200 para que MP no reintente
      }

      // Log completo para debug
      sails.log.verbose(`Procesando: ${notificationType} - ID: ${notificationId}`);

      // Procesar según el tipo
      await sails.helpers.pagos.mercadopago.procesarWebhook.with({
        type: notificationType,
        data: { id: notificationId }
      });

      // Siempre retornar 200 OK para que MP no siga reenviando
      return exits.success();

    } catch (error) {
      sails.log.error("Error al procesar webhook MP:", error);

      // Aunque haya error, retornar 200 para evitar reintentos infinitos
      // El error ya quedó loggeado
      return exits.success();
    }
  }
};
