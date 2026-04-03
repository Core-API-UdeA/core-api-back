module.exports = {
  datastore: 'CoreApiDB',
  tableName: 'api_endpoints',
  attributes: {
    id:          { type: 'string', columnType: 'uuid', required: true },
    path:        { type: 'string', required: true },
    method: {
      type: 'string',
      isIn: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      required: true,
    },
    description: { type: 'string', allowNull: true },
    created_at:  { type: 'ref', columnType: 'timestamp' },

    // ─── Auth / flujo de autenticación ────────────────────────────────────
    // TRUE si este endpoint genera un token (ej: POST /authorize, POST /login)
    is_auth_endpoint:    { type: 'boolean', defaultsTo: false },
    // Descripción libre del flujo de auth requerido para llamar este endpoint
    auth_notes:          { type: 'string', allowNull: true },
    // UUID del endpoint que se debe llamar primero para obtener el token
    requires_token_from: { type: 'string', allowNull: true },

    api_version_id: { model: 'apiversion', required: true },
    parameters: { collection: 'apiparameter', via: 'endpoint_id' },
    bodies:     { collection: 'apibody',      via: 'endpoint_id' },
    responses:  { collection: 'apiresponse',  via: 'endpoint_id' },
  },
};
