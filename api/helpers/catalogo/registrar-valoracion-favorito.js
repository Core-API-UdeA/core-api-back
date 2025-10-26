module.exports = {
  friendlyName: "Register rating or favorite",

  description:
    "Helper to register or update a user rating or favorite for an API.",

  inputs: {
    apiId: {
      type: "string",
      required: true,
      description: "API ID to rate or mark as favorite.",
    },
    userId: {
      type: "string",
      required: true,
      description: "User performing the action.",
    },
    rating: {
      type: "number",
      allowNull: true,
      min: 1,
      max: 5,
      description: "Rating value from 1 to 5.",
    },
  },

  exits: {
    success: { description: "Interaction registered successfully." },
  },

  fn: async function ({ apiId, userId, rating }) {
    sails.log.verbose("-----> Helper: Register rating or favorite");
    var flaverr = require("flaverr");

    try {
      await Api.getDatastore().transaction(async (db) => {
        // Busca si ya existe interacción previa (favorito o rating)
        const existing = await ApiUserInteraction.findOne({
          where: { api_id: apiId, user_id: userId },
        });

        let favorite = existing ? !existing.favorite : true;

        if (existing) {
          // Si existe, se actualiza
          await ApiUserInteraction.updateOne({ id: existing.id })
            .set({
              rating: rating ?? existing.rating,
              favorite: favorite,
            })
            .usingConnection(db);
        } else {
          // Si no existe, se crea una nueva interacción
          await ApiUserInteraction.create({
            api_id: apiId,
            user_id: userId,
            rating,
            favorite,
          }).usingConnection(db);
        }

        // Recalcular promedio y número de calificaciones
        const ratings = await ApiUserInteraction.find({
          where: {
            api_id: apiId,
            rating: { "!=": null },
          },
        });

        const totalVotes = ratings.length;
        const avgRating =
          totalVotes > 0
            ? ratings.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
              totalVotes
            : 0;

        // Actualizar en la tabla de APIs
        await Api.updateOne({ id: apiId })
          .set({
            rating_average: avgRating.toFixed(2),
            rating_count: totalVotes,
          })
          .usingConnection(db);
        return favorite;
      });
    } catch (error) {
      sails.log.error("Error in registrarValoracionFavorito:", error);
      throw flaverr({ code: "E_REG_VAL_FAV" }, error);
    }
  },
};
