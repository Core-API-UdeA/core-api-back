module.exports = {
  friendlyName: "Verificar Pago",

  description: "Verifica el estado de un pago y devuelve la información de la suscripción",

  inputs: {
    transaction_id: {
      type: "string",
      required: true,
      description: "UUID de la transacción"
    },
    payment_id: {
      type: "string",
      required: false,
      description: "ID del pago en Mercado Pago"
    },
    collection_id: {
      type: "string",
      required: false,
      description: "ID de la colección en Mercado Pago"
    },
    status: {
      type: "string",
      required: false,
      description: "Estado reportado por Mercado Pago"
    },
    merchant_order_id: {
      type: "string",
      required: false,
      description: "ID de la orden del comerciante"
    }
  },

  exits: {
    success: {
      description: "Pago verificado exitosamente",
      responseType: "okResponse"
    },
    notFound: {
      description: "Transacción no encontrada",
      responseType: "nokResponse"
    },
    paymentPending: {
      description: "Pago aún está pendiente",
      responseType: "nokResponse"
    },
    paymentFailed: {
      description: "Pago fue rechazado",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error al verificar pago",
      responseType: "nokResponse"
    }
  },

  fn: async function ({
    transaction_id,
    payment_id,
    collection_id,
    status,
    merchant_order_id
  }, exits) {
    sails.log.verbose("-----> Controller: Verificar Pago");

    try {
      // Buscar la transacción
      const transaction = await ApiTransaction.findOne({ id: transaction_id })
        .populate('user_id')
        .populate('api_id')
        .populate('plan_id')
        .populate('subscription_id');

      if (!transaction) {
        return exits.notFound({
          mensaje: "Transacción no encontrada"
        });
      }

      // Actualizar metadata con información de retorno de MP
      if (payment_id || collection_id) {
        await ApiTransaction.updateOne({ id: transaction_id })
          .set({
            payment_metadata: {
              ...transaction.payment_metadata,
              return_payment_id: payment_id || collection_id,
              return_status: status,
              return_merchant_order_id: merchant_order_id,
              return_timestamp: new Date()
            }
          });
      }

      // Si el pago ya está completado, devolver la suscripción
      if (transaction.payment_status === 'completed' && transaction.subscription_id) {
        const subscription = await ApiSubscription.findOne({
          id: transaction.subscription_id
        });

        return exits.success({
          mensaje: "Pago verificado exitosamente",
          data: {
            success: true,
            transaction_id: transaction.id,
            subscription_id: subscription.id,
            api_key: subscription.api_key,
            plan_name: transaction.plan_id.name,
            api_name: transaction.api_id.title,
            amount: transaction.total_amount,
            status: transaction.payment_status,
            subscription_status: subscription.status,
            start_date: subscription.start_date,
            end_date: subscription.end_date,
            message: "Tu suscripción está activa"
          }
        });
      }

      // Si está pendiente o en proceso
      if (['pending', 'processing'].includes(transaction.payment_status)) {
        // Intentar obtener el estado actual del pago desde MP
        if (payment_id || collection_id) {
          try {
            const { MercadoPagoConfig, Payment } = require('mercadopago');
            const client = new MercadoPagoConfig({
              accessToken: sails.config.mercadoPagoAccessToken
            });
            const payment = new Payment(client);

            const paymentInfo = await payment.get({
              id: payment_id || collection_id
            });

            // Si ahora está aprobado, procesar el pago
            if (paymentInfo.status === 'approved') {
              // Forzar el procesamiento del webhook
              await sails.helpers.pagos.mercadopago.procesarWebhook.with({
                type: 'payment',
                data: { id: paymentInfo.id }
              });

              // Esperar un momento para que se procese
              await new Promise(resolve => setTimeout(resolve, 2000));

              // Volver a consultar la transacción
              const updatedTransaction = await ApiTransaction.findOne({
                id: transaction_id
              })
              .populate('subscription_id');

              if (updatedTransaction.payment_status === 'completed' &&
                  updatedTransaction.subscription_id) {
                const subscription = await ApiSubscription.findOne({
                  id: updatedTransaction.subscription_id
                });

                return exits.success({
                  mensaje: "Pago procesado exitosamente",
                  data: {
                    success: true,
                    transaction_id: updatedTransaction.id,
                    subscription_id: subscription.id,
                    api_key: subscription.api_key,
                    plan_name: transaction.plan_id.name,
                    api_name: transaction.api_id.title,
                    amount: updatedTransaction.total_amount,
                    status: updatedTransaction.payment_status,
                    subscription_status: subscription.status,
                    start_date: subscription.start_date,
                    end_date: subscription.end_date,
                    message: "Tu suscripción está activa"
                  }
                });
              }
            }
          } catch (mpError) {
            sails.log.error('Error al consultar MP:', mpError);
            // Continuar con el flujo normal
          }
        }

        return exits.paymentPending({
          mensaje: "El pago está siendo procesado",
          data: {
            success: false,
            transaction_id: transaction.id,
            status: transaction.payment_status,
            message: "Tu pago está siendo procesado. Te notificaremos cuando esté listo."
          }
        });
      }

      // Si falló
      if (['failed', 'cancelled', 'rejected'].includes(transaction.payment_status)) {
        return exits.paymentFailed({
          mensaje: "El pago no pudo ser procesado",
          data: {
            success: false,
            transaction_id: transaction.id,
            status: transaction.payment_status,
            message: "Tu pago fue rechazado. Por favor intenta nuevamente con otro método de pago."
          }
        });
      }

      // Estado desconocido
      return exits.errorGeneral({
        mensaje: "Estado de pago desconocido",
        data: {
          success: false,
          transaction_id: transaction.id,
          status: transaction.payment_status,
          message: "Hubo un problema al verificar tu pago. Por favor contacta a soporte."
        }
      });

    } catch (error) {
      sails.log.error("Error al verificar pago:", error);
      return exits.errorGeneral({
        mensaje: error.message || "Error al verificar el pago"
      });
    }
  }
};
