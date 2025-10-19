module.exports = {
  friendlyName: "Obtener API Overview",

  description:
    "Helper to get detailed overview information of a specific API, including owner, rating, and versions.",

  inputs: {
    apiId: {
      type: "string",
      required: true,
      description: "UUID of the API to retrieve.",
    },
  },

  exits: {
    success: { description: "All done." },
  },

  fn: async function ({ apiId }, exits) {
    sails.log.verbose("-----> Helper: Obtener API Overview");
    const flaverr = require("flaverr");

    try {
      // Buscar API con su dueño y versiones
      let api = await Api.findOne({ id: apiId }).populate("owner_id").populate("versions");
/*         .populate("owner_id", { select: ["id", "username", "email"] })
        .populate("versions", {
          select: ["id", "version_name", "changelog", "created_at"],
        }); */

      // Organizar la información que quiero enviar al front
      api.owner_id = {
        id: api.owner_id.id,
        username: api.owner_id.username,
        email: api.owner_id.email,
      };

      api.versions = api.versions.map((v) => ({
        id: v.id,
        version_name: v.version_name,
        changelog: v.changelog,
        created_at: v.created_at,
      }));

      if (!api) {
        throw flaverr({ code: "E_API_NOT_FOUND" }, new Error("API not found"));
      }

      // Obtener cantidad de favoritos y calificaciones
      const interactions = await ApiUserInteraction.find({ api_id: apiId });
      const totalFavorites = interactions.filter(
        (i) => i.favorite === true
      ).length;
      const totalRatings = interactions.filter((i) => i.rating !== null).length;
      const averageRating =
        totalRatings > 0
          ? interactions.reduce((acc, i) => acc + (i.rating || 0), 0) /
            totalRatings
          : 0;
      // Actualizar métricas agregadas (para mantener sincronizado)
      await Api.updateOne({ id: apiId }).set({
        rating_average: averageRating,
        rating_count: totalRatings,
      });

      // Formatear la salida final
      const overview = {
        id: api.id,
        title: api.title,
        type: api.type,
        short_summary: api.short_summary,
        price: api.price,
        technology_stack: api.technology_stack,
        readme: api.readme,
        rating_average: parseFloat(averageRating.toFixed(2)),
        rating_count: totalRatings,
        favorites: totalFavorites,
        owner: api.owner_id
          ? {
              id: api.owner_id.id,
              username: api.owner_id.username,
              email: api.owner_id.email,
            }
          : null,
        versions: api.versions || [],
        created_at: api.created_at,
      };

      return overview;
    } catch (error) {
      throw flaverr({ code: "E_OBTENER_API_OVERVIEW" }, error);
    }
  },
};
