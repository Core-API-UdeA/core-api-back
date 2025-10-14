module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_endpoints",

  attributes: {
    api_version_id: {
      model: "apiversion",
      required: true,
    },
    path: { type: "string", required: true, maxLength: 255 },
    method: {
      type: "string",
      isIn: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      required: true,
    },
    description: { type: "string", allowNull: true },
    created_at: { type: "ref", columnType: "timestamp", defaultsTo: new Date() },

    parameters: { collection: "apiparameter", via: "endpoint_id" },
    bodies: { collection: "apibody", via: "endpoint_id" },
    responses: { collection: "apiresponse", via: "endpoint_id" },
  },
};
