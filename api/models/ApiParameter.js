module.exports = {
  datastore: 'CoreApiDB',
  tableName: 'api_parameters',
  attributes: {
    name:        { type: 'string' },
    type:        { type: 'string' },
    required:    { type: 'boolean', defaultsTo: false },
    description: { type: 'string', allowNull: true },
    example:     { type: 'string', allowNull: true },
    // 'query' | 'header' | 'path' | 'body'
    location:    { type: 'string', defaultsTo: 'query', allowNull: true },
    endpoint_id: { model: 'apiendpoint' },
  }
};
