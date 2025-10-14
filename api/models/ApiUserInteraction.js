module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_user_interactions",

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
      allowNull: true,
      min: 1,
      max: 5,
    },
    favorito: {
      type: "boolean",
      defaultsTo: false,
    },
    created_at: {
      type: "ref",
      columnType: "timestamp",
      defaultsTo: new Date(),
    },
    updated_at: {
      type: "ref",
      columnType: "timestamp",
      defaultsTo: new Date(),
    },
  },
};
