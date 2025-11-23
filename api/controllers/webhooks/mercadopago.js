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
        sails.log.warn("Webhook sin tipo o ID válido, ignorando");
        return exits.success(); // Retornar 200 para que MP no reintente
      }

      // Log para debug
      sails.log.verbose(`Procesando webhook: ${notificationType} - ID: ${notificationId}`);

      // Procesar según el tipo con manejo de errores
      try {
        const result = await sails.helpers.pagos.mercadopago.procesarWebhook.with({
          type: notificationType,
          data: { id: notificationId }
        });

        if (result.ignored) {
          sails.log.verbose(`Webhook ignorado (recurso no encontrado): ${notificationType} - ${notificationId}`);
        } else {
          sails.log.verbose(`Webhook procesado exitosamente: ${notificationType} - ${notificationId}`);
        }
      } catch (processingError) {
        // Log del error pero no fallar el webhook
        sails.log.error('Error al procesar webhook:', {
          type: notificationType,
          id: notificationId,
          error: processingError.message || processingError
        });

        // Si es un error de "no encontrado", es probablemente un timing issue
        // MP envía webhooks muy rápido, a veces antes de que el recurso esté disponible
        if (processingError.status === 404 ||
            processingError.error === 'not_found' ||
            processingError.message?.includes('not found')) {
          sails.log.warn(`Recurso no encontrado (timing issue), webhook será reintentado por MP si es necesario`);
        }
      }

      // SIEMPRE retornar 200 OK para que MP no siga reenviando
      // Los errores ya quedaron loggeados arriba
      return exits.success();

    } catch (error) {
      // Error crítico en el controlador mismo
      sails.log.error("Error crítico en webhook controller:", error);

      // Aún así retornar 200 para evitar reintentos infinitos
      // El error quedó loggeado
      return exits.success();
    }
  }
};
