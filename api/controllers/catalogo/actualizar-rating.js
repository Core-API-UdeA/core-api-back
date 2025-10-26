module.exports = {
  friendlyName: 'Actualizar calificación',

  description: 'Registers or updates a user rating for an API.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      example: 'uuid-of-api',
    },
    rating: {
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      description: 'Rating between 1 and 5.',
    },
  },

  exits: {
    success: {
      description: 'Rating updated successfully.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Unexpected error while updating rating.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ apiId, rating }, exits) {
    sails.log.verbose('-----> Controller: Actualizar calificación');

    try {
      const userId = this.req.decoded.sub;

      await sails.helpers.catalogo.registrarValoracionFavorito.with({
        apiId,
        userId,
        rating,
      });

      return exits.success({
        mensaje: 'Rating registered successfully.',
        data: { apiId, rating },
      });
    } catch (error) {
      sails.log.error('Error updating rating:', error);
      return exits.errorGeneral(error.message);
    }
  },
};
