module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_plans",

  attributes: {
    api_id: { model: "api", required: true },
    name: { type: "string", required: true },
    description: { type: "string", allowNull: true },
    price: { type: "number", columnType: "numeric", required: true },
    billing_cycle: {
      type: "string",
      isIn: ["monthly", "yearly", "lifetime", "pay_per_use"],
      required: true,
    },

    max_requests_per_month: { type: "number", allowNull: true },
    max_requests_per_day: { type: "number", allowNull: true },
    max_requests_per_minute: { type: "number", allowNull: true },

    features: { type: "json" },

    is_active: { type: "boolean", defaultsTo: true },
    is_popular: { type: "boolean", defaultsTo: false },

    created_at: { type: "ref", columnType: "timestamp", autoCreatedAt: true },
    updated_at: { type: "ref", columnType: "timestamp", autoUpdatedAt: true },

    subscriptions: { collection: "apisubscription", via: "plan_id" },
  },
};
