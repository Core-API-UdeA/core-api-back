module.exports = {
  datastore: 'CoreApiDB',
  tableName: 'plans',

  attributes: {
    id: {
      type: 'string',
      columnType: 'uuid',
      required: true,
      unique: true
    },
    api_id: {
      model: 'api',
      required: true
    },
    name: {
      type: 'string',
      required: true
    },
    type: {
      type: 'string',
      required: true
    },
    price_cents: {
      type: 'number',
      columnType: 'integer'
    },
    currency: {
      type: 'string'
    },
    included_requests: {
      type: 'string',
      columnType: 'bigint'
    },
    cost_per_request_cents: {
      type: 'number',
      columnType: 'integer'
    },
    rate_limit_requests_per_minute: {
      type: 'number',
      columnType: 'integer'
    },
    created_at: {
      type: 'ref',
      columnType: 'timestamp',
      defaultsTo: new Date()
    },
    updated_at: {
      type: 'ref',
      columnType: 'timestamp',
      defaultsTo: new Date()
    }
  },
};
