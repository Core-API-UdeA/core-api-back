/**
 * api/controllers/pagos/suscribir-gratis.js
 *
 * Activa un plan gratuito (price = 0) sin pasarela de pago.
 *
 * Ruta:   POST /pagos/suscribir-gratis
 * Policy: auth/is-authenticated
 */

module.exports = {
  friendlyName: 'Suscribir a plan gratuito',

  description: 'Activa una suscripción gratuita directamente sin pasar por pasarela de pago.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      description: 'UUID de la API.',
    },
    planId: {
      type: 'string',
      required: true,
      description: 'UUID del plan gratuito.',
    },
  },

  exits: {
    success: {
      description: 'Suscripción gratuita activada.',
      responseType: 'okResponse',
    },
    alreadySubscribed: {
      description: 'Ya tiene una suscripción activa.',
      responseType: 'nokResponse',
    },
    invalidPlan: {
      description: 'Plan no encontrado o no es gratuito.',
      responseType: 'nokResponse',
    },
    errorGeneral: {
      description: 'Error inesperado.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ apiId, planId }, exits) {
    sails.log.verbose('-----> Controller: Suscribir gratis');

    try {
      const userId = this.req.decoded.sub;

      const resultado = await sails.helpers.pagos.suscribirGratis.with({
        userId,
        apiId,
        planId,
      });

      return exits.success({
        mensaje: '¡Suscripción activada! Ya puedes empezar a usar esta API.',
        data: resultado,
      });

    } catch (error) {
      sails.log.error('Error al suscribir gratis:', error);

      if (error.code === 'alreadySubscribed') {
        return exits.alreadySubscribed({
          mensaje: error.message || 'Ya tienes una suscripción activa a esta API.',
        });
      }

      if (error.code === 'invalidPlan' || error.code === 'notFree') {
        return exits.invalidPlan({
          mensaje: error.message || 'El plan seleccionado no es válido o no es gratuito.',
        });
      }

      return exits.errorGeneral({
        mensaje: error.message || 'Error al activar la suscripción gratuita.',
      });
    }
  },
};
