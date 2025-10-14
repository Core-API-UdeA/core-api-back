module.exports = {
  friendlyName: 'Register rating or favorite',

  description: 'Register or update user rating or favorite for an API.',

  inputs: {
    apiId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    rating: { type: 'number', min: 1, max: 5 },
    favorite: { type: 'boolean' },
  },

  exits: {
    success: {
      description: 'User rating or favorite updated successfully.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Unexpected error updating user rating or favorite.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ apiId, userId, rating, favorite }, exits) {
    sails.log.verbose('-----> Controller: Register rating or favorite');
    try {
      const result = await sails.helpers.catalogo.registrarValoracionFavorito.with({
        apiId,
        userId,
        rating,
        favorite,
      });

      return exits.success({
        mensaje: 'Rating/Favorite updated successfully.',
        datos: result,
      });
    } catch (error) {
      sails.log.error('Error registering rating/favorite:', error);
      return exits.errorGeneral(error.message);
    }
  },
};
