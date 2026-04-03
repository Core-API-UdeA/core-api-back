/**
 * api/helpers/pagos/suscribir-gratis.js
 *
 * Activa una suscripción gratuita (price = 0) directamente, sin pasar
 * por ninguna pasarela de pago. Crea la suscripción y la transacción
 * con status 'completed' en una sola transacción de BD.
 */

module.exports = {
  friendlyName: 'Suscribir gratis',

  description:
    'Crea una suscripción activa para un plan gratuito sin pasar por pasarela de pago.',

  inputs: {
    userId: {
      type: 'string',
      required: true,
      description: 'UUID del usuario que se suscribe.',
    },
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

  fn: async function ({ userId, apiId, planId }) {
    sails.log.verbose('-----> Helper: Suscribir gratis | userId:', userId, '| planId:', planId);
    const { v4: uuidv4 } = require('uuid');
    const flaverr = require('flaverr');

    try {
      let resultado;

      await Api.getDatastore().transaction(async (db) => {

        // 1. Verificar suscripción activa existente
        const existente = await ApiSubscription.findOne({
          user_id: userId,
          api_id:  apiId,
          status:  'active',
        }).usingConnection(db);

        if (existente) {
          throw flaverr(
            { code: 'alreadySubscribed' },
            new Error('Ya tienes una suscripción activa a esta API.')
          );
        }

        // 2. Verificar que el plan existe, está activo y es realmente gratuito
        const plan = await ApiPlan.findOne({
          id:       planId,
          api_id:   apiId,
          is_active: true,
        }).usingConnection(db);

        if (!plan) {
          throw flaverr(
            { code: 'invalidPlan' },
            new Error('Plan no encontrado o inactivo.')
          );
        }

        if (Number(plan.price) !== 0) {
          throw flaverr(
            { code: 'notFree' },
            new Error('Este plan no es gratuito. Usa el flujo de pago normal.')
          );
        }

        // 3. Obtener la API
        const api = await Api.findOne({ id: apiId }).usingConnection(db);
        if (!api) {
          throw new Error('API no encontrada.');
        }

        const ahora = new Date();

        // 4. Crear la suscripción activa directamente
        const suscripcionId = uuidv4();
        const suscripcion = await ApiSubscription.create({
          id:         suscripcionId,
          user_id:    userId,
          api_id:     apiId,
          plan_id:    planId,
          status:     'active',
          start_date: ahora,
          requests_used_this_month: 0,
          requests_used_this_day:   0,
          last_reset_date: ahora,
          auto_renew: true,
          created_at: ahora,
          updated_at: ahora,
        }).fetch().usingConnection(db);

        // 5. Registrar transacción completada (amount = 0)
        const transaccionId = uuidv4();
        await ApiTransaction.create({
          id:               transaccionId,
          user_id:          userId,
          api_id:           apiId,
          plan_id:          planId,
          subscription_id:  suscripcionId,
          transaction_type: 'purchase',
          amount:           0,
          currency:         'USD',
          tax_amount:       0,
          total_amount:     0,
          platform_fee:     0,
          owner_payout:     0,
          payment_status:   'completed',
          payment_provider: 'mercadopago', // campo requerido — valor referencial para plan gratis
          description:      `Suscripción gratuita: ${plan.name} - ${api.title}`,
          transaction_date: ahora,
          completed_at:     ahora,
          metadata: {
            api_title:  api.title,
            plan_name:  plan.name,
            free_plan:  true,
          },
        }).usingConnection(db);

        resultado = {
          subscription_id: suscripcionId,
          plan_name:       plan.name,
          api_name:        api.title,
          status:          'active',
          start_date:      ahora,
        };

        sails.log.verbose('Suscripción gratuita creada:', suscripcionId);
      });

      return resultado;

    } catch (error) {
      sails.log.error('Error en helper suscribir-gratis:', error);

      if (['alreadySubscribed', 'invalidPlan', 'notFree'].includes(error.code)) {
        throw error;
      }

      throw flaverr(
        { code: 'E_SUSCRIBIR_GRATIS' },
        new Error(`Error al activar suscripción gratuita: ${error.message}`)
      );
    }
  },
};
