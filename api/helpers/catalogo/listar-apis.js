module.exports = {
  friendlyName: "Listar APIs",

  description:
    "Obtiene todas las APIs con información resumida para el catálogo.",

  inputs: {
    pagination: {
      type: "ref",
      required: true,
      description:
        "Información de paginación (page, rowsPerPage, sortBy, descending, limit).",
    },
    filter: {
      type: "ref",
      required: false,
      description:
        "Filtros opcionales (tipo, tecnología, búsqueda por título, etc).",
    },
  },

  fn: async function ({ pagination, filter }) {
    sails.log.verbose("-----> Helper: Listar APIs");
    const flaverr = require("flaverr");

    try {
      // --- PAGINACIÓN ---
      let { page, rowsPerPage, sortBy, descending } = pagination;
      const startRow = (page - 1) * rowsPerPage;
      let filtroSortBy = [];
      const limit = +pagination.limite;

      // --- ORDENAMIENTO ---
      let sort = {};
      if (sortBy) {
        sort[sortBy] = descending ? "DESC" : "ASC";
        filtroSortBy = [sort];
      } else {
        sort.push({ created_at: "DESC" });
      }

      // --- FILTRO DINÁMICO ---
      let filtroWhere = {};

      let queryCount = {
        where: filtroWhere,
      };

      let queryTable = {
        where: filtroWhere,
        skip: startRow,
        limit: rowsPerPage,
        sort: filtroSortBy,
      };

      // --- CONTAR TOTAL DE REGISTROS ---
      pagination.rowsNumber = await Api.count(queryCount);

      // --- CONSULTAR APIS CON DATOS DEL DUEÑO ---
      const apis = await Api.find(queryTable)
        .populate("owner_id");

      //.populate("owner_id", { select: ["id", "username", "email"] });

      // --- FORMATEAR SALIDA ---
      const resultado = {
        data: apis.map((api) => ({
          id: api.id,
          title: api.title,
          type: api.type,
          short_summary: api.short_summary,
          price: api.price,
          rating_average: api.rating_average,
          rating_count: api.rating_count,
          views: api.views,
          technology_stack: api.technology_stack,
          owner: api.owner_id
            ? {
                id: api.owner_id.id,
                username: api.owner_id.username,
                email: api.owner_id.email,
              }
            : null,
          created_at: api.created_at,
        })),
      };

      return {
        pagination: pagination,
        apis: resultado,
      };
    } catch (error) {
      throw flaverr({ code: "E_LISTAR_APIS" }, error);
    }
  },
};
