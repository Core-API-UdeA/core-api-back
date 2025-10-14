module.exports = {
  friendlyName: 'Get API detail',

  description: 'Get complete API detail including overview, versions, and documentation.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      example: 'uuid-of-api',
    },
  },

  exits: {
    success: {
      description: 'API detail retrieved successfully.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Unexpected error while getting API detail.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ apiId }, exits) {
    sails.log.verbose('-----> Controller: Get API detail');
    try {
      const apiDetail = await sails.helpers.catalogo.obtenerDetalleApi.with({ apiId });

      return exits.success({
        mensaje: 'API detail retrieved successfully.',
        datos: apiDetail,
      });
    } catch (error) {
      sails.log.error('Error retrieving API detail:', error);
      return exits.errorGeneral(error.message);
    }
  },
};
