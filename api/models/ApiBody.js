module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_bodies",

  attributes: {
    endpoint_id: {
      model: "apiendpoint",
      required: true,
    },
    content_type: { type: "string", allowNull: true, maxLength: 50 },
    example: { type: "json" },
  },
};
