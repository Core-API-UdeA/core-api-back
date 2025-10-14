module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_parameters",

  attributes: {
    endpoint_id: {
      model: "apiendpoint",
      required: true,
    },
    name: { type: "string", required: true, maxLength: 100 },
    type: { type: "string", allowNull: true, maxLength: 50 },
    required: { type: "boolean", defaultsTo: false },
    description: { type: "string", allowNull: true },
  },
};
