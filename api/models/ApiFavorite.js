module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_favorites",

  attributes: {
    user_id: {
      model: "user",
      required: true,
    },
    api_id: {
      model: "api",
      required: true,
    },
    created_at: { type: "ref", columnType: "timestamp", defaultsTo: new Date() },
  },

  primaryKey: "id",
  unique: [["user_id", "api_id"]], // cada usuario solo puede marcar una vez una API
};
