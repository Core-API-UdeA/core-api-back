module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_versions",

  attributes: {
    api_id: {
      model: "api",
      required: true,
    },
    version_name: { type: "string", required: true, maxLength: 50 },
    changelog: { type: "string", allowNull: true },
    created_at: { type: "ref", columnType: "timestamp", defaultsTo: new Date() },

    endpoints: {
      collection: "apiendpoint",
      via: "api_version_id",
    },
    documentation: {
      collection: "apidocumentation",
      via: "api_version_id",
    },
  },
};
