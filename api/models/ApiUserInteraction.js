module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_user_interactions",

  attributes: {
    rating: { type: "number", isIn: [1, 2, 3, 4, 5], allowNull: true },
    favorite: { type: "boolean", defaultsTo: false },
    created_at: { type: "ref", columnType: "timestamp" },
    user_id: { model: "user", required: true },
    api_id: { model: "api", required: true }
  }
};
