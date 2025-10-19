module.exports = {
  friendlyName: 'Actualizar favorito',

  description: 'Mark or unmark an API as favorite for the logged-in user.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      example: 'uuid-of-api',
    },
    favorite: {
      type: 'boolean',
      required: true,
      description: 'True to mark favorite, false to remove favorite.',
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

  fn: async function ({ apiId, favorite }, exits) {
    sails.log.verbose('-----> Controller: Actualizar favorito');

    try {
      const userId = this.req.decoded.sub;

      await sails.helpers.catalogo.registrarValoracionFavorito.with({
        apiId,
        userId,
        favorite,
      });

      return exits.success({
        mensaje: favorite
          ? 'API marked as favorite successfully.'
          : 'API removed from favorites.',
        datos: { apiId, favorite },
      });
    } catch (error) {
      sails.log.error('Error updating favorite:', error);
      return exits.errorGeneral(error.message);
    }
  },
};
