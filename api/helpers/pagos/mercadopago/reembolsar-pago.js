module.exports = {
  friendlyName: "Reembolsar Pago",

  description: "Crea un reembolso total o parcial en Mercado Pago",

  inputs: {
    paymentId: {
      type: "string",
      required: true,
      description: "ID del pago en Mercado Pago"
    },
    amount: {
      type: "number",
      required: false,
      description: "Monto a reembolsar (opcional, si no se pasa reembolsa todo)"
    }
  },

  fn: async function ({ paymentId, amount }) {
    sails.log.verbose(`-----> Reembolsando pago MP: ${paymentId}`);
    const { MercadoPagoConfig, Refund } = require('mercadopago');

    try {
      const client = new MercadoPagoConfig({
        accessToken: sails.config.custom.mercadoPagoAccessToken
      });

      const refund = new Refund(client);

      const refundData = {
        payment_id: parseInt(paymentId)
      };

      if (amount) {
        refundData.amount = amount;
      }

      const response = await refund.create({ body: refundData });

      sails.log.verbose(`Reembolso creado: ${response.id}`);

      return {
        success: true,
        refund: {
          id: response.id,
          payment_id: response.payment_id,
          amount: response.amount,
          status: response.status,
          date_created: response.date_created
        }
      };

    } catch (error) {
      sails.log.error('Error al reembolsar pago MP:', error);
      throw new Error(`Error al reembolsar: ${error.message}`);
    }
  }
};
