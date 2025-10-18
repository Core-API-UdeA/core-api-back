module.exports = {
  friendlyName: 'Listar APIs',

  description: 'Listar todas las APIs con overview data para la vista de catálogo.',

  inputs: {
    pagination: {
      description: 'Parámetros de paginación (page, rowsPerPage, sortBy, descending, limit).',
      type: 'ref',
      required: true,
    },

    filter: {
      description: 'Filtros opcionales (por tipo, título, tecnología, etc).',
      type: 'ref',
      required: false,
    },
  },

  exits: {
    success: {
      description: 'Listado de APIs obtenido exitosamente.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Error inesperado durante la obtención de APIs.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ pagination, filter }, exits) {
    sails.log.verbose('-----> Controlador: Listar APIs');

    try {
      const apis = await sails.helpers.catalogo.listarApis.with({
        pagination,
        filter,
      });

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
