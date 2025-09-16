module.exports = {
  datastore: "CoreApiDB",
  tableName: 'organizations',

  attributes: {
    id: {
      type: 'string',
      columnType: 'uuid',
      required: true,
      unique: true,
      autoIncrement: false
    },

    name: {
      type: 'string',
      required: true
    },

    slug: {
      type: 'string',
      unique: true,
      required: true
    },

    billing_info: {
      type: 'json',
      columnType: 'jsonb',
    },

    memberships: {
      collection: 'organizationmembership',
      via: 'organization'
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
