module.exports = {
  friendlyName: "Mostrar FileAssets ",

  description: "Se muestran las Fileassets de las apis registradas.",

  inputs: {
    pagination: {
      description: 'paginacion.',
      example: 'Objeto paginacion ',
      type: 'ref',
      required: true,
    },

    filter: {
      description: 'Filtro.',
      example: 'Objeto Filtro ',
      type: 'ref',
      required: true,
    },
  },

  exits: {
    success: {
      description: "Finalización satisfactoria para enviar OK",
      responseType: "okResponse",
    },

    errorGeneral: {
      description: "Un error sin identificar generado en el try/catch.",
      responseType: "nokResponse",
    },
  },
  fn: async function ({ pagination, filter }, exits) {
    sails.log.verbose('-----> Mostrar FileAssets de las apis');
    var flaverr = require('flaverr');
    try {
      let { page, rowsPerPage, sortBy, descending } = pagination;
      const startRow = (page - 1) * rowsPerPage;
      let filtroSortBy = [];
      let limite = +pagination.limite;
      let sort = {};
      if (sortBy) {
        sails.log.verbose('con sortBy', sortBy);
        sort[sortBy] = descending === 'true' ? 'DESC' : 'ASC';
        filtroSortBy = [sort];
      } else {
        filtroSortBy = [{ type: 'ASC' }];
      }

      let filtroWhere = {};

      let queryCount = {
        where: filtroWhere,
      };

      let queryTabla = {
        where: filtroWhere,
        skip: startRow,
        limit: limite,
        sort: filtroSortBy,
      };

      pagination.rowsNumber = await FileAssets.count(queryCount);

      const api_FileAssets = await FileAssets.find(queryTabla);

      return exits.success({
        mensaje: 'Mostrar FileAssets de las apis fue correcto',
        datos: {
          pagination: pagination,
          api_FileAssets: api_FileAssets
        }
      });


    } catch (error) {
      throw flaverr(
        {
          code: 'E_LISTA_APIS_FILEASSETS',
        },
        error
      );
    }

  },
};
