module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_responses",

  attributes: {
    endpoint_id: {
      model: "apiendpoint",
      required: true,
    },
    status_code: { type: "number", allowNull: true },
    content_type: { type: "string", allowNull: true, maxLength: 50 },
    example: { type: "json" },
  },
};
