// api/helpers/catalogo/gestionar-plan.js
module.exports = {
  friendlyName: "Gestionar Plan de API",

  description: "Crea o actualiza un plan de una API",

  inputs: {
    planId: {
      type: "string",
      required: false,
      description: "UUID del plan (para actualizar)"
    },
    apiId: {
      type: "string",
      required: true,
      description: "UUID de la API"
    },
    ownerId: {
      type: "string",
      required: true,
      description: "UUID del owner (para validación)"
    },
    planData: {
      type: "json",
      required: true,
      description: "Datos del plan",
      example: {
        name: "Basic",
        description: "Plan básico",
        price: 9.99,
        billing_cycle: "monthly",
        max_requests_per_month: 10000,
        max_requests_per_day: 500,
        max_requests_per_minute: 10,
        features: ["Feature 1", "Feature 2"],
        is_active: true,
        is_popular: false
      }
    }
  },

  exits: {
    success: {
      description: "Plan gestionado exitosamente"
    },
    unauthorized: {
      description: "Usuario no es el owner de la API"
    },
    invalidData: {
      description: "Datos del plan inválidos"
    }
  },

  fn: async function ({ planId, apiId, ownerId, planData }) {
    sails.log.verbose("-----> Helper: Gestionar Plan de API");
    const { v4: uuidv4 } = require("uuid");
    const flaverr = require("flaverr");

    try {
      let plan;

      await Api.getDatastore().transaction(async (db) => {
        // Verificar que la API existe y pertenece al owner
        const api = await Api.findOne({ id: apiId }).usingConnection(db);

        if (!api) {
          throw new Error("API no encontrada");
        }

        if (api.owner_id !== ownerId) {
          throw flaverr(
            { code: "unauthorized" },
            new Error("No tienes permisos para gestionar planes de esta API")
          );
        }

        // Validar datos requeridos
        if (!planData.name || planData.price === undefined || !planData.billing_cycle) {
          throw flaverr(
            { code: "invalidData" },
            new Error("Nombre, precio y ciclo de facturación son requeridos")
          );
        }

        // Validar ciclo de facturación
        const validCycles = ["monthly", "yearly", "lifetime", "pay_per_use"];
        if (!validCycles.includes(planData.billing_cycle)) {
          throw flaverr(
            { code: "invalidData" },
            new Error("Ciclo de facturación inválido")
          );
        }

        // Si hay planId, actualizar; si no, crear
        if (planId) {
          // Actualizar plan existente
          const existingPlan = await ApiPlan.findOne({
            id: planId,
            api_id: apiId
          }).usingConnection(db);

          if (!existingPlan) {
            throw new Error("Plan no encontrado");
          }

          plan = await ApiPlan.updateOne({ id: planId })
            .set({
              name: planData.name,
              description: planData.description || null,
              price: planData.price,
              billing_cycle: planData.billing_cycle,
              max_requests_per_month: planData.max_requests_per_month || null,
              max_requests_per_day: planData.max_requests_per_day || null,
              max_requests_per_minute: planData.max_requests_per_minute || null,
              features: planData.features || [],
              is_active: planData.is_active !== undefined ? planData.is_active : true,
              is_popular: planData.is_popular || false,
              updated_at: new Date()
            })
            .usingConnection(db);

          sails.log.verbose(`Plan actualizado: ${planId}`);

        } else {
          // Crear nuevo plan
          plan = await ApiPlan.create({
            id: uuidv4(),
            api_id: apiId,
            name: planData.name,
            description: planData.description || null,
            price: planData.price,
            billing_cycle: planData.billing_cycle,
            max_requests_per_month: planData.max_requests_per_month || null,
            max_requests_per_day: planData.max_requests_per_day || null,
            max_requests_per_minute: planData.max_requests_per_minute || null,
            features: planData.features || [],
            is_active: planData.is_active !== undefined ? planData.is_active : true,
            is_popular: planData.is_popular || false,
            created_at: new Date(),
            updated_at: new Date()
          })
          .fetch()
          .usingConnection(db);

          sails.log.verbose(`Plan creado: ${plan.id}`);
        }
      });

      return {
        success: true,
        plan: plan,
        message: planId ? "Plan actualizado exitosamente" : "Plan creado exitosamente"
      };

    } catch (error) {
      sails.log.error("Error al gestionar plan:", error);

      if (error.code === "unauthorized" || error.code === "invalidData") {
        throw error;
      }

      throw flaverr(
        { code: "E_GESTIONAR_PLAN" },
        new Error(`Error al gestionar plan: ${error.message}`)
      );
    }
  }
};
