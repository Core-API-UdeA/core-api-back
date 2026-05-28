module.exports = {
  friendlyName: "Verificar Pago",
  description:
    "Verifica el estado de un pago y devuelve la información de la suscripción",

  inputs: {
    transaction_id: {
      type: "string",
      required: true,
      description: "UUID de la transacción",
    },
    payment_id: {
      type: "string",
      required: false,
      description: "ID del pago en Mercado Pago",
    },
    collection_id: {
      type: "string",
      required: false,
      description: "ID de la colección en Mercado Pago",
    },
    status: {
      type: "string",
      required: false,
      description: "Estado reportado por Mercado Pago en la URL de retorno",
    },
    merchant_order_id: {
      type: "string",
      required: false,
      description: "ID de la orden del comerciante",
    },
  },

  exits: {
    success: {
      description: "Pago verificado exitosamente",
      responseType: "okResponse",
    },
    notFound: {
      description: "Transacción no encontrada",
      responseType: "nokResponse",
    },
    paymentPending: {
      description: "Pago aún está pendiente",
      responseType: "okResponse", // ← OK para que el front pueda leer el data
    },
    paymentFailed: {
      description: "Pago fue rechazado",
      responseType: "okResponse", // ← OK para que el front pueda leer el data
    },
    errorGeneral: {
      description: "Error al verificar pago",
      responseType: "nokResponse",
    },
  },

  fn: async function (
    { transaction_id, payment_id, collection_id, status, merchant_order_id },
    exits,
  ) {
    sails.log.verbose(
      "-----> Controller: Verificar Pago | txId:",
      transaction_id,
    );

    try {
      // ─── 1. Buscar la transacción (SIN populate de subscription_id) ────────
      // No populamos subscription_id para que siga siendo un UUID string.
      const transaction = await ApiTransaction.findOne({ id: transaction_id })
        .populate("api_id")
        .populate("plan_id");

      if (!transaction) {
        return exits.notFound({ mensaje: "Transacción no encontrada" });
      }

      // ─── 2. Guardar metadata de retorno de MP ──────────────────────────────
      if (payment_id || collection_id) {
        await ApiTransaction.updateOne({ id: transaction_id }).set({
          payment_metadata: {
            ...transaction.payment_metadata,
            return_payment_id: payment_id || collection_id,
            return_status: status,
            return_merchant_order_id: merchant_order_id,
            return_timestamp: new Date(),
          },
        });
      }

      // ─── 3. Si ya está completado → retornar directo ───────────────────────
      if (
        transaction.payment_status === "completed" &&
        transaction.subscription_id
      ) {
        return await _buildSuccessResponse(transaction, exits);
      }

      // ─── 4. Si está pendiente → intentar forzar procesamiento ─────────────
      if (["pending", "processing"].includes(transaction.payment_status)) {
        const mpPaymentId = payment_id || collection_id;

        if (mpPaymentId) {
          try {
            const { MercadoPagoConfig, Payment } = require("mercadopago");
            const client = new MercadoPagoConfig({
              accessToken: sails.config.mercadoPagoAccessToken,
            });
            const payment = new Payment(client);

            sails.log.verbose("Consultando MP por payment_id:", mpPaymentId);
            const paymentInfo = await payment.get({ id: mpPaymentId });

            sails.log.verbose(
              "Estado MP:",
              paymentInfo.status,
              paymentInfo.status_detail,
            );

            if (paymentInfo.status === "approved") {
              // Procesar el webhook manualmente
              await sails.helpers.pagos.mercadopago.procesarWebhook.with({
                type: "payment",
                data: { id: paymentInfo.id },
              });

              // Esperar más tiempo para que se procese la suscripción
              await new Promise((r) => setTimeout(r, 3000));

              // Re-consultar la transacción actualizada
              const updated = await ApiTransaction.findOne({
                id: transaction_id,
              })
                .populate("api_id")
                .populate("plan_id");

              if (
                updated.payment_status === "completed" &&
                updated.subscription_id
              ) {
                return await _buildSuccessResponse(updated, exits);
              }
            }

            // MP dice que falló → retornar como fallido
            if (["rejected", "cancelled"].includes(paymentInfo.status)) {
              return exits.paymentFailed({
                mensaje: "El pago fue rechazado",
                data: {
                  success: false,
                  transaction_id: transaction.id,
                  status: "failed",
                  mp_status: paymentInfo.status,
                  mp_detail: paymentInfo.status_detail,
                  message:
                    "Tu pago fue rechazado. Por favor intenta con otro método de pago.",
                },
              });
            }
          } catch (mpError) {
            // En sandbox suele fallar — no es crítico, seguimos
            sails.log.warn(
              "No se pudo consultar MP (normal en sandbox):",
              mpError.message,
            );
          }
        }

        // ── 4b. Si el front dice que MP aprobó (status en URL = approved)
        //        pero el webhook aún no llegó, esperar un poco más ────────────
        if (status === "approved") {
          sails.log.verbose("MP URL dice approved, esperando webhook...");
          await new Promise((r) => setTimeout(r, 4000));

          const updated = await ApiTransaction.findOne({ id: transaction_id })
            .populate("api_id")
            .populate("plan_id");

          if (
            updated.payment_status === "completed" &&
            updated.subscription_id
          ) {
            return await _buildSuccessResponse(updated, exits);
          }
        }

        // Aún pending → devolver estado para que el front reintente
        return exits.paymentPending({
          mensaje: "El pago está siendo procesado",
          data: {
            success: false,
            pending: true,
            transaction_id: transaction.id,
            status: transaction.payment_status,
            mp_status: status,
            message:
              "Tu pago está siendo procesado. La página se actualizará automáticamente.",
          },
        });
      }

      // ─── 5. Si falló ───────────────────────────────────────────────────────
      if (
        ["failed", "cancelled", "rejected"].includes(transaction.payment_status)
      ) {
        return exits.paymentFailed({
          mensaje: "El pago no pudo ser procesado",
          data: {
            success: false,
            transaction_id: transaction.id,
            status: transaction.payment_status,
            message: "Tu pago fue rechazado. Por favor intenta nuevamente.",
          },
        });
      }

      // ─── 6. Estado desconocido ─────────────────────────────────────────────
      return exits.paymentPending({
        mensaje: "Verificando estado del pago...",
        data: {
          success: false,
          pending: true,
          transaction_id: transaction.id,
          status: transaction.payment_status,
          message: "Estamos verificando tu pago. Por favor espera un momento.",
        },
      });
    } catch (error) {
      sails.log.error("Error al verificar pago:", error);
      return exits.errorGeneral({
        mensaje: error.message || "Error al verificar el pago",
      });
    }
  },
};

// ─── Helper interno ───────────────────────────────────────────────────────────

async function _buildSuccessResponse(transaction, exits) {
  // subscription_id es un UUID string (no populado)
  const subId =
    typeof transaction.subscription_id === "object"
      ? transaction.subscription_id?.id
      : transaction.subscription_id;

  const subscription = await ApiSubscription.findOne({ id: subId });

  if (!subscription) {
    sails.log.error(
      "Suscripción no encontrada para transaction:",
      transaction.id,
    );
    return exits.errorGeneral({
      mensaje: "No se encontró la suscripción asociada al pago.",
    });
  }

  // api_id y plan_id pueden ser objeto (populado) o UUID (sin populate)
  const apiTitle = transaction.api_id?.title ?? "API";
  const planName = transaction.plan_id?.name ?? "Plan";

  return exits.success({
    mensaje: "Pago verificado exitosamente",
    data: {
      success: true,
      transaction_id: transaction.id,
      subscription_id: subscription.id,
      api_key: subscription.api_key,
      plan_name: planName,
      api_name: apiTitle,
      amount: transaction.total_amount,
      status: transaction.payment_status,
      subscription_status: subscription.status,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
      message: "Tu suscripción está activa",
    },
  });
}
