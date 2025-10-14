module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_ratings",

  attributes: {
    user_id: {
      model: "user",
      required: true,
    },
    api_id: {
      model: "api",
      required: true,
    },
    rating: {
      type: "number",
      min: 1,
      max: 5,
      required: true,
    },
    comment: { type: "string", allowNull: true },
    created_at: { type: "ref", columnType: "timestamp", defaultsTo: new Date() },
  },

  primaryKey: "id",
  unique: [["user_id", "api_id"]], // cada usuario solo puede valorar una API una vez
};
