module.exports = {
  friendlyName: 'Obtener API Documentation',

  description: 'Retrieve detailed documentation (endpoints, parameters, bodies, responses) for a specific API.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      description: 'UUID of the API whose documentation should be retrieved.',
    },
  },

  exits: {
    success: {
      description: 'API documentation retrieved successfully.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Unexpected error while retrieving API documentation.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ apiId }, exits) {
    sails.log.verbose('-----> Controller: Obtener API Documentation');

    try {
      const documentation = await sails.helpers.catalogo.obtenerApiDocumentation.with({ apiId });

      return exits.success({
        mensaje: 'API documentation retrieved successfully.',
        datos: documentation,
      });
    } catch (error) {
      sails.log.error('Error retrieving API documentation:', error);
      return exits.errorGeneral(error.message);
    }
  },
};
