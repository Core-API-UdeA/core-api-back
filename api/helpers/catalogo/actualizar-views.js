module.exports = {
  friendlyName: "Actualizar API Views",

  description:
    "Helper to increment the view count of an API. Can optionally track unique views per user/session.",

  inputs: {
    apiId: {
      type: "string",
      required: true,
      description: "UUID of the API to update views.",
    },
    userId: {
      type: "string",
      required: false,
      description: "UUID of the user viewing the API (optional, for tracking unique views).",
    },
    sessionId: {
      type: "string",
      required: false,
      description: "Session ID for anonymous users (optional).",
    },
    trackUnique: {
      type: "boolean",
      required: false,
      defaultsTo: false,
      description: "If true, only count unique views per user/session within a time window.",
    },
    uniqueWindow: {
      type: "number",
      required: false,
      defaultsTo: 3600, // 1 hora en segundos
      description: "Time window in seconds to consider a view as unique (default: 3600 = 1 hour).",
    },
  },

  fn: async function ({ apiId, userId, sessionId, trackUnique, uniqueWindow }) {
    sails.log.verbose("-----> Helper: Actualizar API Views");
    const flaverr = require("flaverr");

    try {
      let result = {
        viewCounted: false,
        totalViews: 0,
        isUnique: false,
      };

      await Api.getDatastore().transaction(async (db) => {
        // 1. Verificar que la API exista
        const api = await Api.findOne({ id: apiId }).usingConnection(db);

        if (!api) {
          throw flaverr(
            { code: "E_API_NOT_FOUND" },
            new Error(`API with id ${apiId} not found`)
          );
        }

        sails.log.verbose(`API encontrada: ${api.title}, vistas actuales: ${api.views}`);

        let shouldCount = true;

        // 2. Si se solicita tracking único, verificar si ya fue vista recientemente
        if (trackUnique && (userId || sessionId)) {
          // Buscar vista reciente en ApiUserInteraction o crear sistema de tracking
          const identifier = userId || sessionId;
          const cutoffTime = new Date(Date.now() - (uniqueWindow * 1000));

          // Si tienes un modelo para tracking de vistas, úsalo aquí
          // Por ahora, si existe ApiUserInteraction, verificar la última actualización
          if (userId) {
            const interaction = await ApiUserInteraction.findOne({
              api_id: apiId,
              user_id: userId,
            }).usingConnection(db);

            if (interaction && interaction.updated_at) {
              const lastView = new Date(interaction.updated_at);

              // Si la última vista fue dentro de la ventana de tiempo, no contar
              if (lastView > cutoffTime) {
                shouldCount = false;
                sails.log.verbose(
                  `Vista no contada - usuario ${userId} vio esta API hace menos de ${uniqueWindow} segundos`
                );
              } else {
                result.isUnique = true;
              }
            } else {
              result.isUnique = true;
            }

            // Actualizar el timestamp de la interacción
            if (interaction) {
              await ApiUserInteraction.updateOne({ id: interaction.id })
                .set({ updated_at: new Date() })
                .usingConnection(db);
            }
          } else {
            // Para sesiones anónimas, siempre contar como única
            // En producción, podrías usar Redis o una tabla temporal para esto
            result.isUnique = true;
          }
        } else {
          // Sin tracking único, siempre contar
          result.isUnique = true;
        }

        // 3. Incrementar el contador de vistas si corresponde
        if (shouldCount) {
          const updatedApi = await Api.updateOne({ id: apiId })
            .set({ views: api.views + 1 })
            .usingConnection(db);

          result.viewCounted = true;
          result.totalViews = updatedApi.views;

          sails.log.verbose(
            `Vista contada. Total de vistas ahora: ${updatedApi.views}`
          );
        } else {
          result.viewCounted = false;
          result.totalViews = api.views;
        }
      });

      return {
        success: true,
        data: result,
        message: result.viewCounted
          ? "View counted successfully"
          : "View not counted (already viewed recently)",
      };
    } catch (error) {
      sails.log.error("Error en helper Actualizar API Views:", error);

      if (error.code === "E_API_NOT_FOUND") {
        throw error;
      }

      throw flaverr(
        {
          code: "E_ACTUALIZAR_API_VIEWS",
          message: "Error al actualizar las vistas de la API",
        },
        error
      );
    }
  },
};
