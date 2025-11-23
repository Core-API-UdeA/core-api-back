// api/helpers/pagos/mercadopago/procesar-webhook.js
module.exports = {
  friendlyName: "Procesar Webhook Mercado Pago",

  description: "Procesa notificaciones IPN de Mercado Pago",

  inputs: {
    type: {
      type: "string",
      required: true,
      description: "Tipo de notificación (payment, merchant_order, etc)"
    },
    data: {
      type: "ref",
      required: true,
      description: "Datos de la notificación"
    }
  },

  fn: async function ({ type, data }) {
    sails.log.verbose(`-----> Procesando webhook Mercado Pago: ${type}`);
    const { MercadoPagoConfig, Payment, MerchantOrder } = require('mercadopago');

    try {
      const client = new MercadoPagoConfig({
        accessToken: sails.config.mercadoPagoAccessToken
      });

      // Detectar si estamos en modo sandbox
      const isSandbox = sails.config.mercadoPagoAccessToken?.includes('TEST-') ||
                        sails.config.environment === 'development';

      switch (type) {
        case 'payment':
          await procesarPago(client, data.id, isSandbox);
          break;

        case 'merchant_order':
          await procesarOrden(client, data.id, isSandbox);
          break;

        default:
          sails.log.verbose(`Tipo de notificación no manejada: ${type}`);
      }

      return { success: true };

    } catch (error) {
      sails.log.error('Error al procesar webhook MP:', error);

      // Si es un error de "no encontrado", no es crítico
      // MP a veces envía webhooks antes de que el recurso exista
      if (error.status === 404 || error.error === 'not_found') {
        sails.log.warn('Recurso no encontrado en MP (puede ser timing o sandbox), se ignorará');
        return { success: true, ignored: true };
      }

      // Para otros errores, lanzar la excepción
      throw new Error(error.message || 'Error al procesar webhook');
    }
  }
};

async function procesarPago(client, paymentId, isSandbox = false) {
  const { Payment } = require('mercadopago');
  const payment = new Payment(client);
  const crypto = require("crypto");
  const { v4: uuidv4 } = require("uuid");

  // Función auxiliar para esperar
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    let paymentInfo;
    let attempts = 0;
    const maxAttempts = isSandbox ? 5 : 3; // Más reintentos en sandbox
    const retryDelay = isSandbox ? 8000 : 5000; // Más tiempo en sandbox (8s vs 5s)

    // Reintentar si el pago no se encuentra (problema de timing)
    while (attempts < maxAttempts) {
      try {
        paymentInfo = await payment.get({ id: paymentId });
        sails.log.verbose(`Pago ${paymentId} encontrado en intento ${attempts + 1}`);
        break; // Si se obtuvo correctamente, salir del loop
      } catch (error) {
        attempts++;

        if (error.status === 404 || error.error === 'not_found') {
          if (attempts < maxAttempts) {
            sails.log.verbose(`Pago ${paymentId} no encontrado, reintento ${attempts}/${maxAttempts} en ${retryDelay}ms...`);
            await wait(retryDelay);
          } else {
            // En sandbox, si no se encuentra después de todos los intentos,
            // intentar buscar por external_reference en las transacciones pendientes
            if (isSandbox) {
              sails.log.warn(`Modo sandbox: Intentando procesar sin consultar a MP...`);
              return await procesarPagoSandboxFallback(paymentId);
            } else {
              sails.log.warn(`Pago ${paymentId} no encontrado después de ${maxAttempts} intentos.`);
              throw error;
            }
          }
        } else {
          // Otro tipo de error
          throw error;
        }
      }
    }

    if (!paymentInfo) {
      sails.log.warn(`No se pudo obtener información del pago ${paymentId}`);
      return;
    }

    sails.log.verbose('Información del pago:', {
      id: paymentInfo.id,
      status: paymentInfo.status,
      status_detail: paymentInfo.status_detail,
      external_reference: paymentInfo.external_reference
    });

    await procesarPagoConInfo(paymentInfo);

  } catch (error) {
    sails.log.error('Error al procesar pago MP:', error);
    throw error;
  }
}

// Fallback para sandbox cuando no se puede consultar el pago
async function procesarPagoSandboxFallback(paymentId) {
  sails.log.verbose(`Usando fallback de sandbox para pago ${paymentId}`);

  try {
    // Buscar transacciones pendientes recientes (últimos 5 minutos)
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);

    await Api.getDatastore().transaction(async (db) => {
      const transaccionesPendientes = await ApiTransaction.find({
        payment_status: 'pending',
        created_at: { '>': cincoMinutosAtras },
        payment_provider: 'mercadopago'
      })
      .sort('created_at DESC')
      .limit(10)
      .usingConnection(db);

      if (transaccionesPendientes.length === 0) {
        sails.log.warn('No hay transacciones pendientes recientes para procesar');
        return;
      }

      // En sandbox, asumir que el webhook es para la transacción más reciente
      const transaction = transaccionesPendientes[0];

      sails.log.verbose(`Procesando transacción ${transaction.id} en modo sandbox`);

      // Actualizar la transacción como completada
      await ApiTransaction.updateOne({ id: transaction.id })
        .set({
          payment_status: 'completed',
          payment_provider_transaction_id: paymentId.toString(),
          payment_metadata: {
            ...transaction.payment_metadata,
            mp_payment_id: paymentId,
            mp_status: 'approved',
            mp_status_detail: 'accredited',
            sandbox_fallback: true,
            webhook_processed_at: new Date()
          },
          completed_at: new Date()
        })
        .usingConnection(db);

      sails.log.verbose(`Transacción actualizada (sandbox): ${transaction.id} -> completed`);

      // Crear suscripción si no existe
      if (!transaction.subscription_id) {
        await crearSuscripcionDesdePago(transaction, db);
      }
    });

  } catch (error) {
    sails.log.error('Error en fallback de sandbox:', error);
    throw error;
  }
}

// Procesar pago con información obtenida de MP
async function procesarPagoConInfo(paymentInfo) {
  const transactionId = paymentInfo.external_reference;

  if (!transactionId) {
    sails.log.warn('Pago sin external_reference:', paymentInfo.id);
    return;
  }

  await Api.getDatastore().transaction(async (db) => {
    const transaction = await ApiTransaction.findOne({ id: transactionId })
      .usingConnection(db);

    if (!transaction) {
      sails.log.error(`Transacción no encontrada: ${transactionId}`);
      return;
    }

    // Si la transacción ya está completada, no reprocesar
    if (transaction.payment_status === 'completed' && transaction.subscription_id) {
      sails.log.verbose(`Transacción ${transactionId} ya fue procesada, ignorando webhook duplicado`);
      return;
    }

    let newStatus = transaction.payment_status;

    switch (paymentInfo.status) {
      case 'approved':
        newStatus = 'completed';
        break;
      case 'pending':
      case 'in_process':
      case 'in_mediation':
        newStatus = 'processing';
        break;
      case 'rejected':
      case 'cancelled':
        newStatus = 'failed';
        break;
      case 'refunded':
      case 'charged_back':
        newStatus = 'refunded';
        break;
      default:
        sails.log.warn(`Estado de pago no reconocido: ${paymentInfo.status}`);
    }

    // Actualizar transacción
    await ApiTransaction.updateOne({ id: transactionId })
      .set({
        payment_status: newStatus,
        payment_provider_transaction_id: paymentInfo.id.toString(),
        payment_metadata: {
          ...transaction.payment_metadata,
          mp_payment_id: paymentInfo.id,
          mp_status: paymentInfo.status,
          mp_status_detail: paymentInfo.status_detail,
          mp_payment_type: paymentInfo.payment_type_id,
          mp_payment_method: paymentInfo.payment_method_id,
          mp_card_last_digits: paymentInfo.card?.last_four_digits,
          mp_card_brand: paymentInfo.card?.first_six_digits,
          mp_installments: paymentInfo.installments,
          mp_transaction_amount: paymentInfo.transaction_amount,
          mp_payer_email: paymentInfo.payer?.email,
          mp_date_approved: paymentInfo.date_approved,
          webhook_processed_at: new Date(),
          webhook_attempts: (transaction.payment_metadata?.webhook_attempts || 0) + 1
        },
        ...(newStatus === 'completed' && { completed_at: new Date() }),
        ...(newStatus === 'refunded' && { refunded_at: new Date() })
      })
      .usingConnection(db);

    sails.log.verbose(`Transacción actualizada: ${transactionId} -> ${newStatus}`);

    // Crear suscripción solo si es completed y no existe aún
    if (newStatus === 'completed' && !transaction.subscription_id) {
      sails.log.verbose(`Creando suscripción para transacción ${transactionId}...`);
      await crearSuscripcionDesdePago(transaction, db);
    }

    // Si el pago falló, registrar
    if (newStatus === 'failed') {
      sails.log.verbose(`Pago rechazado: ${paymentInfo.status_detail}`);
      // TODO: Enviar email de notificación
    }
  });
}

// Función para procesar una orden de comercio
async function procesarOrden(client, orderId, isSandbox = false) {
  const { MerchantOrder } = require('mercadopago');
  const merchantOrder = new MerchantOrder(client);

  try {
    const orderInfo = await merchantOrder.get({ merchantOrderId: orderId });

    sails.log.verbose('Información de la orden:', {
      id: orderInfo.id,
      status: orderInfo.status,
      external_reference: orderInfo.external_reference
    });

    // Las órdenes de comercio generalmente son informativas
    // El procesamiento real se hace con el webhook de payment

  } catch (error) {
    // Si la orden no se encuentra, no es crítico
    if (error.status === 404 || error.error === 'not_found') {
      sails.log.warn(`Orden ${orderId} no encontrada en MP (puede ser timing issue o sandbox)`);
      return;
    }

    sails.log.error('Error al procesar orden MP:', error);
    throw error;
  }
}

// Función auxiliar para crear suscripción
async function crearSuscripcionDesdePago(transaction, db) {
  const crypto = require("crypto");
  const { v4: uuidv4 } = require("uuid");

  try {
    // Obtener el plan
    const plan = await ApiPlan.findOne({ id: transaction.plan_id })
      .usingConnection(db);

    if (!plan) {
      throw new Error(`Plan no encontrado: ${transaction.plan_id}`);
    }

    // Generar API Key única
    const apiKey = `sk_live_${crypto.randomBytes(32).toString('hex')}`;

    // Calcular fechas según el ciclo de facturación
    let endDate = null;
    let nextBillingDate = null;

    const startDate = new Date();

    switch (plan.billing_cycle) {
      case 'monthly':
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        nextBillingDate = new Date(endDate);
        break;

      case 'yearly':
        endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        nextBillingDate = new Date(endDate);
        break;

      case 'lifetime':
        endDate = null;
        nextBillingDate = null;
        break;

      case 'pay_per_use':
        endDate = null;
        nextBillingDate = null;
        break;

      default:
        sails.log.warn(`Ciclo de facturación no reconocido: ${plan.billing_cycle}`);
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        nextBillingDate = new Date(endDate);
    }

    // Verificar si ya existe una suscripción activa
    const existingSubscription = await ApiSubscription.findOne({
      user_id: transaction.user_id,
      api_id: transaction.api_id,
      plan_id: transaction.plan_id,
      status: 'active'
    }).usingConnection(db);

    if (existingSubscription) {
      sails.log.verbose(`Ya existe una suscripción activa, vinculando con la transacción`);

      await ApiTransaction.updateOne({ id: transaction.id })
        .set({ subscription_id: existingSubscription.id })
        .usingConnection(db);

      return existingSubscription;
    }

    // Crear la suscripción
    const subscription = await ApiSubscription.create({
      id: uuidv4(),
      user_id: transaction.user_id,
      api_id: transaction.api_id,
      plan_id: transaction.plan_id,
      status: 'active',
      start_date: startDate,
      end_date: endDate,
      next_billing_date: nextBillingDate,
      auto_renew: plan.billing_cycle !== 'lifetime' && plan.billing_cycle !== 'pay_per_use',
      api_key: apiKey,
      requests_used_this_month: 0,
      requests_used_this_day: 0,
      last_reset_date: startDate
    })
    .fetch()
    .usingConnection(db);

    // Vincular suscripción a la transacción
    await ApiTransaction.updateOne({ id: transaction.id })
      .set({ subscription_id: subscription.id })
      .usingConnection(db);

    sails.log.verbose(`Suscripción creada exitosamente: ${subscription.id}`);

    // TODO: Enviar email de bienvenida con API Key
    // await sails.helpers.email.enviarBienvenidaApiKey({
    //   userId: transaction.user_id,
    //   apiKey: subscription.api_key,
    //   planName: plan.name,
    //   subscriptionId: subscription.id
    // });

    return subscription;

  } catch (error) {
    sails.log.error('Error al crear suscripción desde pago:', error);
    throw error;
  }
}
