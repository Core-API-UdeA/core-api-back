module.exports = {
  datastore: "CoreApiDB",
  tableName: "apis",

  attributes: {
    title: { type: "string", required: true, maxLength: 150 },
    type: { type: "string", allowNull: true },
    short_summary: { type: "string", allowNull: true },
    price: { type: "number", columnType: "numeric", defaultsTo: 0 },
    rating_count: { type: "number", defaultsTo: 0 },
    rating_average: { type: "number", columnType: "numeric", defaultsTo: 0 },
    views: { type: "number", defaultsTo: 0 },
    technology_stack: { type: "string", allowNull: true },
    readme: { type: "string", allowNull: true },
    created_at: { type: "ref", columnType: "timestamp" },
    updated_at: { type: "ref", columnType: "timestamp" },

    // ─── Campo slug para el gateway ──────────────────────────────────────
    // Identificador URL-friendly: "Open Weather API" → "open-weather-api"
    // Se genera al registrar la API. Usado en: /gateway/<slug>/<ruta>
    slug: {
      type: 'string',
      unique: true,
      maxLength: 160,
      allowNull: true,
    },

    owner_id: { model: "user" },
    versions: { collection: "apiversion", via: "api_id" },
    interactions: { collection: "apiuserinteraction", via: "api_id" },

    // Relación 1:1 con la configuración de conexión del proveedor
    connection: { collection: "apiconnection", via: "api_id" },
  }
};
