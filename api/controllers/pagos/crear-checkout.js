// api/controllers/pagos/crear-checkout.js
module.exports = {
  friendlyName: "Crear Checkout de Pago",

  description: "Crea una sesión de pago con Mercado Pago y retorna el link de checkout",

  inputs: {
    apiId: {
      type: "string",
      required: true,
      description: "UUID de la API a comprar"
    },
    planId: {
      type: "string",
      required: true,
      description: "UUID del plan seleccionado"
    },
    paymentProvider: {
      type: "string",
      isIn: ["stripe", "paypal", "mercadopago"],
      defaultsTo: "mercadopago",
      description: "Proveedor de pagos a usar"
    },
    successUrl: {
      type: "string",
      required: false,
      description: "URL de retorno exitoso (opcional)"
    },
    cancelUrl: {
      type: "string",
      required: false,
      description: "URL de retorno al cancelar (opcional)"
    }
  },

  exits: {
    success: {
      description: "Checkout creado exitosamente",
      responseType: "okResponse"
    },
    unauthorized: {
      description: "Usuario no autenticado",
      responseType: "nokResponse"
    },
    alreadySubscribed: {
      description: "Usuario ya tiene suscripción activa",
      responseType: "nokResponse"
    },
    invalidPlan: {
      description: "Plan no encontrado o inactivo",
      responseType: "nokResponse"
    },
    errorGeneral: {
      description: "Error inesperado al crear checkout",
      responseType: "nokResponse"
    }
  },

  fn: async function ({ apiId, planId, paymentProvider, successUrl, cancelUrl }, exits) {
    sails.log.verbose("-----> Controller: Crear Checkout de Pago");

    try {
      // Verificar que el usuario esté autenticado
      const userId = this.req.decoded.sub

      if (!userId) {
        return exits.unauthorized({
          mensaje: "Debes iniciar sesión para realizar una compra"
        });
      }

      // URLs por defecto si no se proporcionan
      const defaultSuccessUrl = successUrl || `${sails.config.custom.baseUrl}/payment/success`;
      const defaultCancelUrl = cancelUrl || `${sails.config.custom.baseUrl}/payment/cancel`;

      // Crear el checkout
      const checkout = await sails.helpers.pagos.crearCheckout.with({
        userId,
        apiId,
        planId,
        paymentProvider,
        successUrl: defaultSuccessUrl,
        cancelUrl: defaultCancelUrl
      });

      return exits.success({
        mensaje: "Checkout creado exitosamente",
        data: checkout
      });

    } catch (error) {
      sails.log.error("Error al crear checkout:", error);

      if (error.code === "alreadySubscribed") {
        return exits.alreadySubscribed({
          mensaje: error.message || "Ya tienes una suscripción activa a esta API"
        });
      }

      if (error.code === "invalidPlan") {
        return exits.invalidPlan({
          mensaje: error.message || "El plan seleccionado no es válido"
        });
      }

      return exits.errorGeneral({
        mensaje: error.message || "Error al crear checkout de pago"
      });
    }
  }
};
