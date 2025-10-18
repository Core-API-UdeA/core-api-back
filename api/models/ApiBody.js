module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_bodies",
  attributes: {
    content_type: { type: "string" },
    example: { type: "json" },
    endpoint_id: { model: "apiendpoint" }
  }
};
