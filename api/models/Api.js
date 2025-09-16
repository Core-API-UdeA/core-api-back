module.exports = {
  datastore: 'CoreApiDB',
  tableName: 'apis',

  attributes: {
    id: {
      type: 'string',
      columnType: 'uuid',
      required: true,
      unique: true
    },


    owner_user_id: {
      model: 'user',
      required: true
    },

    organization_id: {
      model: 'organization',
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

    short_description: {
      type: 'string',
      columnType: 'text'
    },

    long_description: {
      type: 'string',
      columnType: 'text'
    },

    category: {
      type: 'string'
    },

    state: {
      type: 'string'
    },

    visibility: {
      type: 'string'
    },

    default_plan_id: {
      type: 'string',
      columnType: 'uuid'
    },

    created_at: {
      type: 'ref',
      columnType: 'timestamp',
      autoCreatedAt: true
    },

    updated_at: {
      type: 'ref',
      columnType: 'timestamp',
      autoUpdatedAt: true
    }
  },
};
