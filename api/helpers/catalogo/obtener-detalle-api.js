module.exports = {
  friendlyName: 'Get API detail',

  description: 'Helper to fetch an API with overview, versions, endpoints, and documentation.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    success: { description: 'All done.' },
  },

  fn: async function ({ apiId }) {
    sails.log.verbose('-----> Helper: Get API detail');
    var flaverr = require('flaverr');

    try {
      const api = await Api.findOne({ id: apiId })
        .populate('versions');

      if (!api) {
        throw flaverr({ code: 'E_API_NOT_FOUND' }, new Error('API not found'));
      }

      // Para cada versión, obtenemos sus endpoints con parámetros, cuerpos y respuestas
      const versionsWithEndpoints = await Promise.all(
        api.versions.map(async (version) => {
          const endpoints = await ApiEndpoint.find({ api_version_id: version.id })
            .populate('parameters')
            .populate('bodies')
            .populate('responses');

          return { ...version, endpoints };
        })
      );

      return {
        ...api,
        versions: versionsWithEndpoints,
      };
    } catch (error) {
      throw flaverr({ code: 'E_OBTENER_DETALLE_API' }, error);
    }
  },
};
