module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_versions",

  attributes: {
    version_name: { type: "string", required: true },
    changelog: { type: "string", allowNull: true },
    created_at: { type: "ref", columnType: "timestamp" },
    api_id: { model: "api", required: true },
    endpoints: { collection: "apiendpoint", via: "api_version_id" }
  }
};
