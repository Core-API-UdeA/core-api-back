module.exports = {
  datastore: "CoreApiDB",
  tableName: "apis",

  attributes: {
    title: { type: "string", required: true, maxLength: 150 },
    type: { type: "string", allowNull: true, maxLength: 50 },
    price: { type: "number", columnType: "numeric", defaultsTo: 0 },
    rating_count: { type: "number", defaultsTo: 0 },
    rating_average: { type: "number", columnType: "numeric", defaultsTo: 0 },
    short_summary: { type: "string", allowNull: true },
    technology_stack: { type: "string", allowNull: true },
    readme: { type: "string", allowNull: true },
    created_at: { type: "ref", columnType: "timestamp", defaultsTo: new Date() },

    owner_id: {
      model: "user",
      columnName: "owner_id",
    },

    // Relationships
    versions: {
      collection: "apiversion",
      via: "api_id",
    },
    favorites: {
      collection: "apifavorite",
      via: "api_id",
    },
    ratings: {
      collection: "apirating",
      via: "api_id",
    },
  },
};
