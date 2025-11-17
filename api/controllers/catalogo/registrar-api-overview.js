module.exports = {
  friendlyName: "Registar API Overview",

  description: "Crear API - Overview",

  inputs: {
    apiId: {
      type: "ref",
      required: false,
      description: "UUID of the API to update.",
    },
    datosApi: {
      type: "json",
      required: true,
      description: "Data object containing API overview information.",
      example: {
        title: "Movie Info API",
        type: "GraphQL",
        short_summary: "Access movie details, ratings, and cast information.",
        price: 14.99,
        technology_stack: "graphql,nodejs,mongodb",
        readme:
          "# Movie Info API\n\nRetrieve movie, cast, and user rating data using GraphQL queries.",
      },
    },
  },

  exits: {
    success: {
      description: "API overview retrieved successfully.",
      responseType: "okResponse",
    },
    errorGeneral: {
      description: "Unexpected error while retrieving API overview.",
      responseType: "nokResponse",
    },
  },

  fn: async function ({ apiId, datosApi }, exits) {
    sails.log.verbose("-----> Controller: Register API Overview",);

    try {
      const apiOverview =
        await sails.helpers.catalogo.registrarApiOverview.with({
          datosApi: datosApi,
          apiId: apiId,
          ownerId: this.req.decoded.sub,
        });

      return exits.success({
        mensaje: "API overview retrieved successfully.",
        data: apiOverview,
      });
    } catch (error) {
      sails.log.error("Error retrieving API overview:", error);
      return exits.errorGeneral(error.message);
    }
  },
};
