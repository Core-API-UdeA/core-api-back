module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_usage_logs",

  attributes: {
    subscription_id: { model: "apisubscription", required: true },
    api_id: { model: "api", required: true },
    user_id: { model: "user", required: true },
    endpoint_id: { model: "apiendpoint"},

    // Información de la petición
    method: { type: "string", required: true },
    endpoint_path: { type: "string", required: true },

    // Respuesta
    status_code: { type: "number", required: true },
    response_time_ms: { type: "number", required: true },

    // Información adicional
    ip_address: { type: "string", allowNull: true },
    user_agent: { type: "string", allowNull: true },

    // Metadata
    request_metadata: { type: "json" },
    error_message: { type: "string", allowNull: true },

    // Fecha
    timestamp: { type: "ref", columnType: "timestamp", autoCreatedAt: true },
  },
};
