module.exports = {
  friendlyName: "Crear Checkout Mercado Pago",

  description: "Crea una preferencia de pago en Mercado Pago y retorna el link de checkout",

  inputs: {
    transaction: {
      type: "ref",
      required: true,
      description: "Objeto de transacción"
    },
    plan: {
      type: "ref",
      required: true,
      description: "Objeto del plan"
    },
    api: {
      type: "ref",
      required: true,
      description: "Objeto de la API"
    }
  },

  exits: {
    success: {
      description: "Preferencia creada exitosamente"
    },
    mpError: {
      description: "Error de Mercado Pago"
    }
  },

  fn: async function ({ transaction, plan, api }) {
    sails.log.verbose("-----> Helper: Crear Checkout Mercado Pago");

    // SDK de Mercado Pago
    const { MercadoPagoConfig, Preference } = require('mercadopago');

    try {
      // VALIDACIONES IMPORTANTES
      const isSandbox = sails.config.mercadoPagoMode !== 'production';

      // Validar que no estemos usando localhost en producción
      if (!isSandbox && (
        transaction.success_url?.includes('localhost') ||
        transaction.cancel_url?.includes('localhost') ||
        sails.config.baseUrl?.includes('localhost')
      )) {
        throw new Error('No se pueden usar URLs localhost en modo producción. Usa ngrok o un dominio público.');
      }

      // Log para debugging
      sails.log.verbose('Configuración MP:', {
        mode: sails.config.mercadoPagoMode,
        isSandbox,
        hasToken: !!sails.config.mercadoPagoAccessToken,
        tokenPrefix: sails.config.mercadoPagoAccessToken?.substring(0, 10)
      });

      // Configurar cliente de Mercado Pago
      const client = new MercadoPagoConfig({
        accessToken: sails.config.mercadoPagoAccessToken,
        options: {
          timeout: 5000,
          // Para sandbox, asegúrate de estar usando el token correcto
          integratorId: sails.config.mercadoPagoIntegratorId || undefined
        }
      });

      const preference = new Preference(client);

      // Preparar items - VALIDAR CAMPOS
      const items = [{
        id: String(plan.id),
        title: `${api.title} - Plan ${plan.name}`.substring(0, 256), // Límite de MP
        description: (plan.description || `Suscripción al plan ${plan.name} de ${api.title}`).substring(0, 256),
        picture_url: api.image_url || undefined, // undefined es mejor que null
        category_id: 'services',
        quantity: 1,
        unit_price: parseFloat(transaction.total_amount),
        currency_id: transaction.currency || 'USD' // Asegurar que tenga valor
      }];

      // URLs de retorno - solo HTTP/HTTPS válidos
      const baseSuccessUrl = transaction.success_url || `${sails.config.baseUrl}/payment/success`;
      const baseCancelUrl = transaction.cancel_url || `${sails.config.baseUrl}/payment/cancel`;

      const backUrls = {
        success: `${baseSuccessUrl}?transaction_id=${transaction.id}`,
        failure: `${baseCancelUrl}?transaction_id=${transaction.id}`,
        pending: `${baseSuccessUrl}?transaction_id=${transaction.id}&status=pending`
      };

      // Metadata - mantener simple y sin datos sensibles
      const metadata = {
        transaction_id: String(transaction.id),
        plan_id: String(transaction.plan_id),
        api_id: String(transaction.api_id)
      };

      // Calcular fecha de expiración (máximo 30 días)
      const now = new Date();
      const expirationDate = new Date(transaction.expires_at);
      const maxExpiration = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

      if (expirationDate > maxExpiration) {
        expirationDate.setTime(maxExpiration.getTime());
      }

      // Crear la preferencia con campos mínimos requeridos
      const preferenceData = {
        items: items,
        back_urls: backUrls,
        auto_return: 'approved',
        external_reference: String(transaction.id),

        // Payer info - REQUERIDO
        // En sandbox usa el email del test user que te proporcionó Mercado Pago
        payer: {
          email: isSandbox
            ? 'test_user_910469563@testuser.com' // Email del test user
            : (transaction.user_email || 'user@example.com')
        },

        // Configuración de pago
        payment_methods: {
          excluded_payment_types: [],
          installments: plan.price > 100 ? 12 : 1,
          default_installments: 1
        },

        // Fechas de expiración
        expiration_date_from: now.toISOString(),
        expiration_date_to: expirationDate.toISOString(),

        // Statement descriptor
        statement_descriptor: api.title.substring(0, 20),

        // Notification URL - debe ser HTTPS en producción
        notification_url: `${sails.config.baseUrl}${sails.config.prefix || ''}/webhooks/mercadopago`.trim(),

        // Binary mode
        binary_mode: false,

        // Metadata simplificado
        metadata: metadata
      };

      sails.log.verbose('Creando preferencia en Mercado Pago:', {
        transaction_id: transaction.id,
        amount: transaction.total_amount,
        plan: plan.name,
        mode: isSandbox ? 'sandbox' : 'production'
      });

      // Log completo solo en desarrollo
      if (isSandbox) {
        console.log('Preference Data:', JSON.stringify(preferenceData, null, 2));
      }

      // Crear preferencia en MP
      const response = await preference.create({ body: preferenceData });

      if (!response || !response.id) {
        throw new Error('Mercado Pago no retornó un ID de preferencia válido');
      }

      sails.log.verbose(`Preferencia creada: ${response.id}`);

      // Actualizar transacción con datos de MP
      await ApiTransaction.updateOne({ id: transaction.id })
        .set({
          payment_provider_checkout_id: response.id,
          payment_metadata: {
            mp_preference_id: response.id,
            mp_init_point: response.init_point,
            mp_sandbox_init_point: response.sandbox_init_point,
            mp_collector_id: response.collector_id,
            mp_client_id: response.client_id,
            mp_date_created: response.date_created
          }
        });

      // Retornar la URL de checkout según el ambiente
      const checkoutUrl = isSandbox
        ? response.sandbox_init_point
        : response.init_point;

      return checkoutUrl;

    } catch (error) {
      sails.log.error('Error al crear checkout en Mercado Pago:', error);

      // Log detallado del error
      if (error.cause) {
        sails.log.error('MP Error details:', JSON.stringify(error.cause, null, 2));
      }

      // Crear un Error real para Sails
      const mpError = new Error(`Error de Mercado Pago: ${error.message}`);
      mpError.code = 'E_MP_ERROR';
      mpError.details = error.cause || error;
      mpError.raw = error;

      // Throw usando el exit definido
      throw mpError;
    }
  }
};
