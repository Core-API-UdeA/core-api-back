module.exports = {
  datastore: 'CoreApiDB',
  tableName: 'file_assets',

  attributes: {
    id: {
      type: 'string',
      columnType: 'uuid',
      required: true,
      unique: true
    },

    api: {
      model: 'api',
      columnName: 'api_id'
    },

    type: {
      type: 'string',
      required: true
    },

    s3_key: {
      type: 'string',
      required: true
    },

    checksum: {
      type: 'string',
      allowNull: true
    },

    size: {
      type: 'string',
      columnType: 'bigint'
    },

    created_at: {
      type: 'ref',
      columnType: 'timestamp',
      defaultsTo: new Date()
    }
  }
};
