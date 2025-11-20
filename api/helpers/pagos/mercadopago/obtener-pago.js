// api/helpers/pagos/mercadopago/obtener-pago.js
module.exports = {
  friendlyName: "Obtener Información de Pago",

  description: "Obtiene información detallada de un pago de Mercado Pago",

  inputs: {
    paymentId: {
      type: "string",
      required: true,
      description: "ID del pago en Mercado Pago"
    }
  },

  fn: async function ({ paymentId }) {
    sails.log.verbose(`-----> Obteniendo pago MP: ${paymentId}`);
    const { MercadoPagoConfig, Payment } = require('mercadopago');

    try {
      const client = new MercadoPagoConfig({
        accessToken: sails.config.mercadoPagoAccessToken
      });

      const payment = new Payment(client);
      const paymentInfo = await payment.get({ id: paymentId });

      return {
        success: true,
        payment: {
          id: paymentInfo.id,
          status: paymentInfo.status,
          status_detail: paymentInfo.status_detail,
          transaction_amount: paymentInfo.transaction_amount,
          currency_id: paymentInfo.currency_id,
          payment_method: paymentInfo.payment_method_id,
          payment_type: paymentInfo.payment_type_id,
          date_created: paymentInfo.date_created,
          date_approved: paymentInfo.date_approved,
          payer: {
            email: paymentInfo.payer?.email,
            identification: paymentInfo.payer?.identification
          },
          external_reference: paymentInfo.external_reference
        }
      };

    } catch (error) {
      sails.log.error('Error al obtener pago MP:', error);
      throw new Error(`Error al obtener pago: ${error.message}`);
    }
  }
};
