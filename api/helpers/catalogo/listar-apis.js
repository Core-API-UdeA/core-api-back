module.exports = {
  friendlyName: "Listar APIs",

  description: "Obtiene todas las APIs con información resumida para el catálogo.",

  inputs: {
    pagination: {
      type: "ref",
      required: true,
      description: "Información de paginación (page, rowsPerPage, sortBy, descending, limit).",
    },
    filter: {
      type: "ref",
      required: false,
      description: "Filtros opcionales (tipo, tecnología, búsqueda por título, etc).",
    },
  },

  exits: {
    success: { description: "All done." },
  },

  fn: async function ({ pagination, filter }, exits) {
    sails.log.verbose("-----> Helper: Listar APIs");
    const flaverr = require("flaverr");

    try {
      // --- PAGINACIÓN ---
      const { page = 1, rowsPerPage = 10, sortBy, descending } = pagination;
      const skip = (page - 1) * rowsPerPage;
      const limit = +rowsPerPage;

      // --- FILTRO DINÁMICO ---
      let filtroWhere = {};
      if (filter) {
        if (filter.type) filtroWhere.type = filter.type;
        if (filter.technology_stack)
          filtroWhere.technology_stack = { contains: filter.technology_stack };
        if (filter.title)
          filtroWhere.title = { contains: filter.title };
      }

      // --- ORDENAMIENTO ---
      let sort = [];
      if (sortBy) {
        const direction = descending ? "DESC" : "ASC";
        sort.push({ [sortBy]: direction });
      } else {
        sort.push({ created_at: "DESC" });
      }

      // --- CONTAR TOTAL DE REGISTROS ---
      const total = await Api.count({ where: filtroWhere });

      // --- CONSULTAR APIS CON DATOS DEL DUEÑO ---
      const apis = await Api.find({
        where: filtroWhere,
        skip,
        limit,
        sort,
        select: [
          "id",
          "title",
          "type",
          "short_summary",
          "price",
          "rating_average",
          "rating_count",
          "views",
          "technology_stack",
          "created_at",
        ],
      })
        .populate("owner_id", { select: ["id", "username", "email"] });

      // --- FORMATEAR SALIDA ---
      const resultado = {
        total,
        page,
        rowsPerPage,
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
          owner: api.owner_id ? {
            id: api.owner_id.id,
            username: api.owner_id.username,
            email: api.owner_id.email,
          } : null,
          created_at: api.created_at,
        })),
      };

      return resultado;
    } catch (error) {
      throw flaverr({ code: "E_LISTAR_APIS" }, error);
    }
  },
};
