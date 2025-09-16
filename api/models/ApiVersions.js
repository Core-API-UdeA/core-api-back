module.exports = {
  datastore: 'CoreApiDB',
  tableName: 'api_versions',

  attributes: {
    id: {
      type: 'string',
      columnType: 'uuid',
      required: true,
      unique: true
    },

    api_id: {
      columnType: 'uuid',
      model: 'api'
    },

    version: { type: 'string', required: true },
    status: { type: 'string' },
    release_notes: { type: 'string', columnName: 'release_notes' },
    created_at: { type: 'ref', columnType: 'timestamp', defaultsTo: new Date() },
    published_at: { type: 'ref', columnType: 'timestamp' }
  },
};
