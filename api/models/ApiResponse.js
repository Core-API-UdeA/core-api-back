module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_responses",
  attributes: {
    status_code: { type: "number" },
    content_type: { type: "string" },
    example: { type: "json" },
    endpoint_id: { model: "apiendpoint" }
  }
};
