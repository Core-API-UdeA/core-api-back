module.exports = {
  friendlyName: "Actualizar Views",
  description: "Incrementa el contador de vistas de una API",

  inputs: {
    apiId: {
      type: "string",
      required: true,
    },
  },

  exits: {
    success: {
      description: "Rating updated successfully.",
      responseType: "okResponse",
    },
    errorGeneral: {
      description: "Unexpected error while updating rating.",
      responseType: "nokResponse",
    },
  },

  fn: async function ({ apiId }, exits) {
    try {
      sails.log.verbose("-----> Controller: Actualizar Views");
      const userId = this.req.decoded.sub || null;

      const sessionId = this.req.decoded.sub || null;

      const result = await sails.helpers.catalogo.actualizarViews.with({
        apiId: apiId,
        userId: userId,
        sessionId: sessionId,
        trackUnique: true,
        uniqueWindow: 3600,
      });

      return exits.success({
        mensaje: "Vistas actualizadas correctamente",
        data: result.data,
      });
    } catch (error) {
      if (error.code === "E_API_NOT_FOUND") {
        throw "notFound";
      }
      return exits.errorGeneral(error.message);
    }
  },
};
