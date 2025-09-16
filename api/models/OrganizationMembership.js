module.exports = {
  datastore: "CoreApiDB",
  tableName: 'organization_memberships',

  attributes: {
    id: {
      type: 'string',
      columnType: 'uuid',
      required: true,
      unique: true,
      autoIncrement: false
    },

    role: {
      type: 'string',
      required: true
    },

    joined_at: {
      type: 'ref',
      columnType: 'timestamp',
      defaultsTo: new Date()
    },

    organization: {
      model: 'organization',
      columnName: 'organization_id'
    },

    user: {
      model: 'user',
      columnName: 'user_id'
    }
  },
};
