module.exports = {
  friendlyName: 'List APIs (Catalog overview)',

  description: 'List all APIs with overview data for catalog display.',

  inputs: {},

  exits: {
    success: {
      description: 'APIs listed successfully.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Unexpected error during API listing.',
      responseType: 'nokResponse',
    },
  },

  fn: async function (_, exits) {
    sails.log.verbose('-----> Controller: List APIs (Catalog overview)');
    try {
      const apis = await sails.helpers.catalogo.listarApis();

      return exits.success({
        mensaje: 'APIs retrieved successfully.',
        datos: apis,
      });
    } catch (error) {
      sails.log.error('Error listing APIs:', error);
      return exits.errorGeneral(error.message);
    }
  },
};
