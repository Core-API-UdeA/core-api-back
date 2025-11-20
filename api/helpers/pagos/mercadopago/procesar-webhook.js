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

      switch (type) {
        case 'payment':
          await procesarPago(client, data.id);
          break;

        case 'merchant_order':
          await procesarOrden(client, data.id);
          break;

        default:
          sails.log.verbose(`Tipo de notificación no manejada: ${type}`);
      }

      return { success: true };

    } catch (error) {
      sails.log.error('Error al procesar webhook MP:', error);
      throw error;
    }
  }
};

async function procesarPago(client, paymentId) {
  const { Payment } = require('mercadopago');
  const payment = new Payment(client);
  const crypto = require("crypto");
  const { v4: uuidv4 } = require("uuid");

  try {
    const paymentInfo = await payment.get({ id: paymentId });

    sails.log.verbose('Información del pago:', {
      id: paymentInfo.id,
      status: paymentInfo.status,
      status_detail: paymentInfo.status_detail,
      external_reference: paymentInfo.external_reference
    });

    const transactionId = paymentInfo.external_reference;

    if (!transactionId) {
      sails.log.warn('Pago sin external_reference:', paymentId);
      return;
    }

    await Api.getDatastore().transaction(async (db) => {
      const transaction = await ApiTransaction.findOne({ id: transactionId })
        .usingConnection(db);

      if (!transaction) {
        sails.log.error(`Transacción no encontrada: ${transactionId}`);
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
            mp_date_approved: paymentInfo.date_approved
          },
          ...(newStatus === 'completed' && { completed_at: new Date() }),
          ...(newStatus === 'refunded' && { refunded_at: new Date() })
        })
        .usingConnection(db);

      sails.log.verbose(`Transacción actualizada: ${transactionId} -> ${newStatus}`);

      if (newStatus === 'completed' && !transaction.subscription_id) {
        await crearSuscripcionDesdePago(transaction, db);
      }

      if (newStatus === 'failed') {
        sails.log.verbose(`Pago rechazado: ${paymentInfo.status_detail}`);
        // TODO ENVIO DE CORREO
      }
    });

  } catch (error) {
    sails.log.error('Error al procesar pago MP:', error);
    throw error;
  }
}

// Función para procesar una orden de comercio
async function procesarOrden(client, orderId) {
  const { MerchantOrder } = require('mercadopago');
  const merchantOrder = new MerchantOrder(client);

  try {
    const orderInfo = await merchantOrder.get({ merchantOrderId: orderId });

    sails.log.verbose('Información de la orden:', {
      id: orderInfo.id,
      status: orderInfo.status,
      external_reference: orderInfo.external_reference
    });

    // Procesar según el estado de la orden
    // Generalmente las órdenes contienen múltiples pagos
    // Aquí puedes agregar lógica adicional si es necesario

  } catch (error) {
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
        // No expira
        endDate = null;
        nextBillingDate = null;
        break;

      default:
        sails.log.warn(`Ciclo de facturación no reconocido: ${plan.billing_cycle}`);
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
      auto_renew: plan.billing_cycle !== 'lifetime',
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

    sails.log.verbose(`Suscripción creada: ${subscription.id}`);

    // TODO: Enviar email de bienvenida con API Key
    // await sails.helpers.email.enviarApiKey(subscription);

    return subscription;

  } catch (error) {
    sails.log.error('Error al crear suscripción desde pago:', error);
    throw error;
  }
}
