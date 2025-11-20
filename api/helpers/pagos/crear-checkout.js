// api/helpers/pagos/crear-checkout.js
module.exports = {
  friendlyName: "Crear Checkout de Pago",

  description:
    "Crea una sesión de pago con el proveedor seleccionado y retorna el link de pago",

  inputs: {
    userId: {
      type: "string",
      required: true,
      description: "UUID del usuario que va a pagar",
    },
    apiId: {
      type: "string",
      required: true,
      description: "UUID de la API a comprar",
    },
    planId: {
      type: "string",
      required: true,
      description: "UUID del plan seleccionado",
    },
    paymentProvider: {
      type: "string",
      isIn: ["stripe", "paypal", "mercadopago"],
      defaultsTo: "stripe",
      description: "Proveedor de pagos a usar",
    },
    successUrl: {
      type: "string",
      required: false,
      description: "URL de retorno exitoso",
    },
    cancelUrl: {
      type: "string",
      required: false,
      description: "URL de retorno al cancelar",
    },
  },

  exits: {
    success: {
      description: "Checkout creado exitosamente",
    },
    invalidPlan: {
      description: "Plan no encontrado o inactivo",
    },
    alreadySubscribed: {
      description: "Usuario ya tiene suscripción activa",
    },
  },

  fn: async function ({
    userId,
    apiId,
    planId,
    paymentProvider,
    successUrl,
    cancelUrl,
  }) {
    sails.log.verbose("-----> Helper: Crear Checkout de Pago");
    const { v4: uuidv4 } = require("uuid");
    const flaverr = require("flaverr");

    try {
      let transaction;
      let checkoutUrl;

      await Api.getDatastore().transaction(async (db) => {
        // 1. Verificar que el usuario no tenga ya una suscripción activa
        const existingSubscription = await ApiSubscription.findOne({
          user_id: userId,
          api_id: apiId,
          status: "active",
        }).usingConnection(db);

        if (existingSubscription) {
          throw flaverr(
            { code: "alreadySubscribed" },
            new Error("Usuario ya tiene una suscripción activa a esta API")
          );
        }

        // 2. Obtener información del plan
        const plan = await ApiPlan.findOne({
          id: planId,
          api_id: apiId,
          is_active: true,
        }).usingConnection(db);

        if (!plan) {
          throw flaverr(
            { code: "invalidPlan" },
            new Error("Plan no encontrado o inactivo")
          );
        }

        // 3. Obtener información de la API
        const api = await Api.findOne({ id: apiId })
          .populate("owner_id")
          .usingConnection(db);

        if (!api) {
          throw new Error("API no encontrada");
        }

        // 4. Calcular montos
        const amount = plan.price;
        const platformFeePercentage = sails.config.platformFeePercentage;
        const platformFee = (amount * platformFeePercentage) / 100;
        const ownerPayout = amount - platformFee;

        // 5. Crear la transacción pendiente
        const transactionId = uuidv4();
        transaction = await ApiTransaction.create({
          id: transactionId,
          user_id: userId,
          api_id: apiId,
          plan_id: planId,
          transaction_type: "purchase",
          amount: amount,
          currency: "USD",
          tax_amount: 0,
          total_amount: amount,
          platform_fee: platformFee,
          owner_payout: ownerPayout,
          payment_status: "pending",
          payment_provider: paymentProvider,
          description: `Suscripción ${plan.name} - ${api.title}`,
          /*TODO success_url: successUrl || `${sails.config.baseUrl}/payment/success`,
          cancel_url: cancelUrl || `${sails.config.baseUrl}/payment/cancel`, */
          success_url: `https://core-api-zeta.vercel.app/payment/success`,
          cancel_url: `https://core-api-zeta.vercel.app/payment/cancel`,
          transaction_date: new Date(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expira en 24h
          metadata: {
            api_title: api.title,
            plan_name: plan.name,
            owner_id: api.owner_id.id,
            owner_email: api.owner_id.email,
          },
        })
          .fetch()
          .usingConnection(db);

        sails.log.verbose(`Transacción creada: ${transactionId}`);

        // 6. Crear checkout según el proveedor
        switch (paymentProvider) {
          case "stripe":
            break;

          case "paypal":
            break;

          case "mercadopago":
            checkoutUrl = await sails.helpers.pagos.mercadopago.crearCheckout(
              transaction,
              plan,
              api
            );
            break;

          default:
            throw new Error(
              `Proveedor de pagos no soportado: ${paymentProvider}`
            );
        }

        // 7. Actualizar la transacción con la URL del checkout
        await ApiTransaction.updateOne({ id: transactionId })
          .set({
            checkout_url: checkoutUrl,
            payment_status: "processing",
          })
          .usingConnection(db);

        sails.log.verbose(`Checkout creado: ${checkoutUrl}`);
      });

      return {
        success: true,
        transaction_id: transaction.id,
        checkout_url: checkoutUrl,
        expires_at: transaction.expires_at,
        message: "Checkout creado exitosamente",
      };
    } catch (error) {
      sails.log.error("Error al crear checkout:", error);

      if (error.code === "alreadySubscribed" || error.code === "invalidPlan") {
        throw error;
      }

      throw flaverr(
        { code: "E_CREAR_CHECKOUT" },
        new Error(`Error al crear checkout: ${error.message}`)
      );
    }
  },
};
