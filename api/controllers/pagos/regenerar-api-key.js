/**
 * api/controllers/pagos/regenerar-api-key.js
 *
 * Genera una nueva API Key para una suscripción activa del usuario.
 * La key anterior queda invalidada inmediatamente.
 *
 * Ruta:   POST /suscripciones/regenerar-api-key
 * Policy: auth/is-authenticated
 */

module.exports = {
  friendlyName: 'Regenerar API Key',

  description: 'Genera una nueva API Key para una suscripción activa, invalidando la anterior.',

  inputs: {
    subscriptionId: {
      type: 'string',
      required: true,
      description: 'UUID de la suscripción a la que pertenece la key.',
    },
  },

  exits: {
    success: {
      description: 'Nueva API Key generada.',
      responseType: 'okResponse',
    },
    notFound: {
      description: 'Suscripción no encontrada.',
      responseType: 'nokResponse',
    },
    forbidden: {
      description: 'La suscripción no pertenece al usuario.',
      responseType: 'nokResponse',
    },
    errorGeneral: {
      description: 'Error inesperado.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ subscriptionId }, exits) {
    sails.log.verbose('-----> Controller: Regenerar API Key | subId:', subscriptionId);

    const crypto = require('crypto');

    try {
      const userId = this.req.decoded.sub;

      // 1. Verificar que la suscripción exista y pertenezca al usuario
      const subscription = await ApiSubscription.findOne({ id: subscriptionId });

      if (!subscription) {
        return exits.notFound({ mensaje: 'Suscripción no encontrada.' });
      }

      if (subscription.user_id !== userId) {
        return exits.forbidden({ mensaje: 'No tienes permiso para modificar esta suscripción.' });
      }

      if (subscription.status !== 'active') {
        return exits.forbidden({ mensaje: 'Solo puedes regenerar la key de suscripciones activas.' });
      }

      // 2. Generar nueva API Key única
      const nuevaKey = `sk_live_${crypto.randomBytes(32).toString('hex')}`;

      // 3. Actualizar en BD
      await ApiSubscription.updateOne({ id: subscriptionId }).set({
        api_key:    nuevaKey,
        updated_at: new Date(),
      });

      sails.log.verbose(`API Key regenerada para suscripción ${subscriptionId}`);

      return exits.success({
        mensaje: 'Nueva API Key generada exitosamente. La anterior ha sido invalidada.',
        data: {
          subscription_id: subscriptionId,
          api_key:         nuevaKey,
          regenerated_at:  new Date().toISOString(),
        },
      });

    } catch (error) {
      sails.log.error('Error al regenerar API Key:', error);
      return exits.errorGeneral({
        mensaje: error.message || 'Error al regenerar la API Key.',
      });
    }
  },
};
