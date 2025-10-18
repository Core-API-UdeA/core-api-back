module.exports = {
  friendlyName: 'Obtener API Documentation',

  description: 'Helper to get the complete documentation of a specific API, including endpoints, parameters, body, and responses.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      description: 'UUID of the API whose documentation should be fetched.',
    },
  },

  exits: {
    success: { description: 'All done.' },
  },

  fn: async function ({ apiId }, exits) {
    sails.log.verbose('-----> Helper: Obtener API Documentation');
    const flaverr = require('flaverr');

    try {
      // Verificar que la API exista
      const api = await Api.findOne({ id: apiId });
      if (!api) {
        throw flaverr({ code: 'E_API_NOT_FOUND' }, new Error('API not found'));
      }

      // Buscar todos los endpoints relacionados con la API
      const endpoints = await ApiEndpoint.find({ api_id: apiId })
        .populate('parameters')
        .populate('bodies')
        .populate('responses');

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

      return exits.success({
        api_id: apiId,
        title: api.title,
        documentation: formattedDocs,
      });
    } catch (error) {
      throw flaverr({ code: 'E_OBTENER_API_DOCUMENTATION' }, error);
    }
  },
};
