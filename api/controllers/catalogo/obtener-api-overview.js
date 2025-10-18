module.exports = {
  friendlyName: 'Get API Overview',

  description: 'Retrieve overview information for a specific API.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      description: 'UUID of the API to retrieve overview data for.',
    },
  },

  exits: {
    success: {
      description: 'API overview retrieved successfully.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Unexpected error while retrieving API overview.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ apiId }, exits) {
    sails.log.verbose('-----> Controller: Get API Overview');

    try {
      const apiOverview = await sails.helpers.catalogo.obtenerApiOverview.with({ apiId });

      return exits.success({
        mensaje: 'API overview retrieved successfully.',
        datos: apiOverview,
      });
    } catch (error) {
      sails.log.error('Error retrieving API overview:', error);
      return exits.errorGeneral(error.message);
    }
  },
};
