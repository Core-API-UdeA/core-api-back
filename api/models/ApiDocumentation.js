module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_documentation",

  attributes: {
    api_version_id: {
      model: "apiversion",
      required: true,
    },
    section_name: { type: "string", allowNull: true, maxLength: 100 },
    content: { type: "string", allowNull: true },
    created_at: { type: "ref", columnType: "timestamp", defaultsTo: new Date() },
  },
};
