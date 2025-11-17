module.exports = {
  friendlyName: "Registrar API Overview",

  description: "Helper to register or update API overview information.",

  inputs: {
    apiId: {
      type: "ref",
      required: false,
      description: "UUID of the API to update.",
    },
    datosApi: {
      type: "json",
      required: true,
      description: "Data object containing API overview information.",
      example: {
        title: "Movie Info API",
        type: "GraphQL",
        short_summary: "Access movie details, ratings, and cast information.",
        price: 14.99,
        technology_stack: "graphql,nodejs,mongodb",
        readme:
          "# Movie Info API\n\nRetrieve movie, cast, and user rating data using GraphQL queries.",
      },
    },
    ownerId: {
      type: "string",
      required: false,
      description: "UUID of the API owner (only for creation).",
    },
  },

  fn: async function ({ apiId, datosApi, ownerId }) {
    sails.log.verbose("-----> Helper: Registrar API Overview");
    const flaverr = require("flaverr");

    try {
      let overview = null;

      overview = await Api.getDatastore().transaction(async (db) => {
        let existingApi = null;

        if (apiId) {
          existingApi = await Api.findOne({ id: apiId }).usingConnection(db);
        }

        if (existingApi) {
          sails.log.verbose(`Actualizando API Overview: ${apiId}`);

          const updateData = {
            updated_at: new Date(),
          };

          if (datosApi.title !== undefined) updateData.title = datosApi.title;
          if (datosApi.type !== undefined) updateData.type = datosApi.type;
          if (datosApi.short_summary !== undefined)
            updateData.short_summary = datosApi.short_summary;
          if (datosApi.price !== undefined) updateData.price = datosApi.price;
          if (datosApi.technology_stack !== undefined)
            updateData.technology_stack = datosApi.technology_stack;
          if (datosApi.readme !== undefined)
            updateData.readme = datosApi.readme;

          await Api.updateOne({ id: apiId })
            .set(updateData)
            .usingConnection(db);

          sails.log.verbose(`API Overview actualizado exitosamente: ${apiId}`);

          const updated = await Api.findOne({ id: apiId })
            .populate("owner_id")
            .usingConnection(db);

          return updated;
        } else {
          sails.log.verbose(`Creando nuevo API Overview`);

          if (!ownerId) {
            throw flaverr(
              { code: "E_MISSING_OWNER" },
              new Error("Se requiere ownerId para crear un nuevo API")
            );
          }

          const createData = {
            title: datosApi.title,
            owner_id: ownerId,
            type: datosApi.type || null,
            short_summary: datosApi.short_summary || null,
            price: datosApi.price || 0,
            rating_count: 0,
            rating_average: 0,
            views: 0,
            technology_stack: datosApi.technology_stack || null,
            readme: datosApi.readme || null,
            created_at: new Date(),
            updated_at: new Date(),
          };

          const created = await Api.create(createData).fetch().usingConnection(db);

          await ApiUserInteraction.create({
            favorite: false,
            created_at: new Date(),
            user_id: ownerId,
            api_id: created.id,
          }).usingConnection(db);

          sails.log.verbose("API Overview creado exitosamente:", overview);
          return created;
        }
      });

      return overview
    } catch (error) {
      sails.log.error("Error en helper Registrar API Overview:", error);

      if (error.code === "E_MISSING_OWNER") {
        throw error;
      }

      throw flaverr(
        {
          code: "E_REGISTRAR_API_OVERVIEW",
          message: "Error al registrar API Overview",
        },
        error
      );
    }
  },
};
