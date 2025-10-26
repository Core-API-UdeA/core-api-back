module.exports = {
  friendlyName: 'Actualizar favorito',

  description: 'Mark or unmark an API as favorite for the logged-in user.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      example: 'uuid-of-api',
    },
  },

  exits: {
    success: {
      description: 'Favorite updated successfully.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Unexpected error while updating favorite.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ apiId }, exits) {
    sails.log.verbose('-----> Controller: Actualizar favorito');

    try {
      const userId = this.req.decoded.sub;

      const favorite = await sails.helpers.catalogo.registrarValoracionFavorito.with({
        apiId,
        userId,
      });

      return exits.success({
        mensaje: favorite
          ? 'API marked as favorite successfully.'
          : 'API removed from favorites.',
        data: { apiId, favorite },
      });
    } catch (error) {
      sails.log.error('Error updating favorite:', error);
      return exits.errorGeneral(error.message);
    }
  },
};
