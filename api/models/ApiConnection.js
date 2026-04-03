
module.exports = {
  datastore: 'CoreApiDB',
  tableName: 'api_connections',

  attributes: {

    // ─── Relación 1:1 con la API ───────────────────────────────────────────
    api_id: {
      model: 'api',
      required: true,
      unique: true,
      description: 'FK a apis.id. Unique garantiza relación 1:1.',
    },

    // ─── URL base del servicio original del proveedor ─────────────────────
    base_url: {
      type: 'string',
      required: true,
      maxLength: 500,
      description: 'URL base del servicio real, ej: https://api.openweathermap.org/data/2.5',
    },

    // ─── Tipo de autenticación que requiere el servicio original ──────────
    auth_type: {
      type: 'string',
      isIn: ['none', 'api_key', 'bearer', 'oauth2'],
      required: true,
      description: 'Mecanismo de autenticación que CoreAPI usa al llamar al proveedor.',
    },

    // ─── Credenciales cifradas (AES-256-GCM) ──────────────────────────────
    // Formato almacenado: "<iv_b64>:<authTag_b64>:<ciphertext_b64>"
    // NULL cuando auth_type = 'none'
    credentials_encrypted: {
      type: 'string',
      allowNull: true,
      description: 'Credenciales cifradas. Formato: iv:authTag:ciphertext (base64).',
    },

    // ─── Nombre del header para API key ───────────────────────────────────
    // Solo relevante cuando auth_type = 'api_key'
    api_key_header_name: {
      type: 'string',
      allowNull: true,
      defaultsTo: 'X-Api-Key',
      description: 'Nombre del header donde se envía la API key. Ej: X-Api-Key.',
    },

    // ─── Endpoint de salud para validar conectividad ──────────────────────
    health_check_endpoint: {
      type: 'string',
      allowNull: true,
      defaultsTo: '/',
      description: 'Ruta relativa para verificar disponibilidad. Ej: /health, /status, /',
    },

    health_check_method: {
      type: 'string',
      isIn: ['GET', 'POST', 'HEAD'],
      defaultsTo: 'GET',
    },

    // ─── Estado de la conexión ────────────────────────────────────────────
    status: {
      type: 'string',
      isIn: ['pending', 'active', 'failed'],
      defaultsTo: 'pending',
      description: 'pending=sin validar, active=verificada, failed=falló la validación.',
    },

    // ─── Resultado de la última verificación de conectividad ──────────────
    last_checked_at: {
      type: 'ref',
      columnType: 'timestamp',
    },

    last_check_status_code: {
      type: 'number',
      allowNull: true,
    },

    last_check_latency_ms: {
      type: 'number',
      allowNull: true,
    },

    // ─── Timestamps ───────────────────────────────────────────────────────
    created_at: {
      type: 'ref',
      columnType: 'timestamp',
      autoCreatedAt: true,
    },

    updated_at: {
      type: 'ref',
      columnType: 'timestamp',
      autoUpdatedAt: true,
    },
  },
};
