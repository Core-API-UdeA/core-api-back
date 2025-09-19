module.exports = {
  friendlyName: "Mostrar versiones de las apis",

  description: "Se muestran las versiones de las apis registradas.",

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
    sails.log.verbose('-----> Mostrar versiones de las apis');
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
        filtroSortBy = [{ version: 'ASC' }];
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

      pagination.rowsNumber = await ApiVersions.count(queryCount);

      const api_versions = await ApiVersions.find(queryTabla);

      return exits.success({
        mensaje: 'la consulta de las versiones de las apis fue correcto',
        datos: {
          pagination: pagination,
          api_versions: api_versions
        }
      });


    } catch (error) {
      throw flaverr(
        {
          code: 'E_LISTA_APIS_VERSIONES',
        },
        error
      );
    }

  },
};
