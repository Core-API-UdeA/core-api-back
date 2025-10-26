module.exports = {
  friendlyName: "Obtener Interaccion de usuario",

  description: "Obtener la interacción de un usuario con una API específica.",

  inputs: {
    apiId: {
      type: "string",
      required: true,
      example: "uuid-of-api",
    },
  },

  exits: {
    success: {
      description: "Favorite updated successfully.",
      responseType: "okResponse",
    },
    errorGeneral: {
      description: "Unexpected error while updating favorite.",
      responseType: "nokResponse",
    },
  },

  fn: async function ({ apiId }, exits) {
    sails.log.verbose("-----> Controller: Obtener favorito");

    try {
      const userId = this.req.decoded.sub;

      const favoriteRecord = await ApiUserInteraction.findOne({
        api_id: apiId,
        user_id: userId,
      });

      const favorite = favoriteRecord ? favoriteRecord.favorite : false;
      const alreadyRated = favoriteRecord ? favoriteRecord.rating : null;

      console.log("Favorite:", favorite);
      console.log("favoriteRecord.rating:", favoriteRecord.rating);

      return exits.success({
        mensaje: "API obtenida correctamente.",
        data: { apiId, favorite, alreadyRated },
      });
    } catch (error) {
      sails.log.error("Error updating favorite:", error);
      return exits.errorGeneral(error.message);
    }
  },
};
