module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_endpoints",

  attributes: {
    id: { type: 'string', columnType: 'uuid', required: true },
    path: { type: "string", required: true },
    method: {
      type: "string",
      isIn: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      required: true,
    },
    description: { type: "string", allowNull: true },
    created_at: { type: "ref", columnType: "timestamp" },

    api_version_id: { model: "apiversion", required: true },

    parameters: { collection: "apiparameter", via: "endpoint_id" },
    bodies: { collection: "apibody", via: "endpoint_id" },
    responses: { collection: "apiresponse", via: "endpoint_id" },
  },
};
