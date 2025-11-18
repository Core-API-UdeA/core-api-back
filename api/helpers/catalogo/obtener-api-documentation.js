module.exports = {
  friendlyName: "Obtener API Documentation",

  description:
    "Helper to get the complete documentation of a specific API, including endpoints, parameters, body, and responses.",

  inputs: {
    apiId: {
      type: "string",
      required: true,
      description: "UUID of the API whose documentation should be fetched.",
    },
  },

  fn: async function ({ apiId }) {
    sails.log.verbose("-----> Helper: Obtener API Documentation");
    const flaverr = require("flaverr");

    try {
      // Verificar que la API exista
      const api = await Api.findOne({ id: apiId });
      if (!api) {
        throw flaverr({ code: "E_API_NOT_FOUND" }, new Error("API not found"));
      }

      // Obtener las versiones de la API
      const versions = await ApiVersion.find({ api_id: apiId });

      // Si no hay versiones, terminar
      if (!versions || versions.length === 0) {
        return {
          api_id: apiId,
          title: api.title,
          documentation: [],
        };
      }

      // Buscar endpoints de todas las versiones
      const versionIds = versions.map((v) => v.id);
      const endpoints = await ApiEndpoint.find({ api_version_id: versionIds })
        .populate("parameters")
        .populate("bodies")
        .populate("responses");

      // Formatear la documentación para el frontend
      const formattedDocs = endpoints.map((ep) => ({
        id: ep.id,
        method: ep.method, // GET, POST, PUT, DELETE, etc.
        path: ep.path,
        description: ep.description,
        parameters: ep.parameters.map((p) => ({
          name: p.name,
          type: p.type,
          required: p.required,
          description: p.description,
        })),
        body: ep.bodies.map((b) => ({
          example: b.example,
          description: b.description,
        })),
        responses: ep.responses.map((r) => ({
          code: r.code,
          example: r.example,
          description: r.description,
        })),
      }));

      return {
        api_id: apiId,
        title: api.title,
        version: {
          id: versions[0].id,
          name: versions[0].version_name,
          changelog: versions[0].changelog,
        },
        documentation: formattedDocs,
      };
    } catch (error) {
      throw flaverr({ code: "E_OBTENER_API_DOCUMENTATION" }, error);
    }
  },
};
