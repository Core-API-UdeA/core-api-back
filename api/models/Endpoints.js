module.exports = {
  datastore: 'CoreApiDB',
  tableName: 'endpoints',

  attributes: {
    id: {
      type: 'string',
      columnType: 'uuid',
      required: true,
      unique: true
    },

    // Relación con api_versions
    apiVersion: {
      model: 'apiversions',
      columnName: 'api_version_id'
    },

    path: {
      type: 'string',
      required: true
    },

    method: {
      type: 'string',
      required: true
    },

    description: {
      type: 'string',
    },

    request_schema: {
      type: 'json',
      columnType: 'jsonb',
    },

    response_schema: {
      type: 'json',
      columnType: 'jsonb',
    },

    examples: {
      type: 'json',
      columnType: 'jsonb',

    }
  }
};
