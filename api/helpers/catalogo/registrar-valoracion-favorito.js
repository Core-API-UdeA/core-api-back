module.exports = {
  friendlyName: 'Register rating or favorite',

  description: 'Helper to register or update a user rating or favorite for an API.',

  inputs: {
    apiId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    rating: { type: 'number', allowNull: true },
    favorite: { type: 'boolean', allowNull: true },
  },

  exits: {
    success: { description: 'All done.' },
  },

  fn: async function ({ apiId, userId, rating, favorite }) {
    sails.log.verbose('-----> Helper: Register rating or favorite');
    var flaverr = require('flaverr');

    try {
      const existing = await ApiUserInteraction.findOne({ api_id: apiId, user_id: userId });

      if (existing) {
        // Update existing record
        await ApiUserInteraction.updateOne({ id: existing.id }).set({
          rating: rating ?? existing.rating,
          favorite: favorite ?? existing.favorite,
        });
      } else {
        // Create new record
        await ApiUserInteraction.create({
          api_id: apiId,
          user_id: userId,
          rating,
          favorite,
        });
      }

      // Recalculate average rating for the API
      const ratings = await ApiUserInteraction.find({ api_id: apiId, rating: { '!=': null } });
      const avg =
        ratings.length > 0
          ? ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length
          : 0;

      await Api.updateOne({ id: apiId }).set({
        rating_average: avg,
        rating_count: ratings.length,
      });

      return { updated: true };
    } catch (error) {
      throw flaverr({ code: 'E_REGISTRAR_VALORACION_FAVORITO' }, error);
    }
  },
};
