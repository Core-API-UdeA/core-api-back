module.exports = {
  friendlyName: 'List APIs',

  description: 'Helper to get all APIs with their overview data.',

  inputs: {},

  exits: {
    success: { description: 'All done.' },
  },

  fn: async function () {
    sails.log.verbose('-----> Helper: List APIs');
    var flaverr = require('flaverr');

    try {
      const apis = await Api.find({
        select: [
          'id',
          'title',
          'type',
          'price',
          'rating_average',
          'rating_count',
          'short_summary',
          'technology_stack',
        ],
      })

      return apis;
    } catch (error) {
      throw flaverr({ code: 'E_LISTAR_APIS' }, error);
    }
  },
};
