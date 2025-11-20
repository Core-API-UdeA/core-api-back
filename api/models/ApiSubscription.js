module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_subscriptions",

  attributes: {
    user_id: { model: "user", required: true },
    api_id: { model: "api", required: true },
    plan_id: { model: "apiplan", required: true },

    status: {
      type: "string",
      isIn: ["active", "cancelled", "expired", "suspended", "trial"],
      defaultsTo: "active"
    },

    start_date: { type: "ref", columnType: "timestamp", required: true },
    end_date: { type: "ref", columnType: "timestamp" },
    trial_end_date: { type: "ref", columnType: "timestamp" },
    cancelled_at: { type: "ref", columnType: "timestamp" },

    requests_used_this_month: { type: "number", defaultsTo: 0 },
    requests_used_this_day: { type: "number", defaultsTo: 0 },
    last_reset_date: { type: "ref", columnType: "timestamp" },

    auto_renew: { type: "boolean", defaultsTo: true },
    next_billing_date: { type: "ref", columnType: "timestamp" },

    api_key: { type: "string", unique: true }, // Token único para usar la API

    created_at: { type: "ref", columnType: "timestamp", autoCreatedAt: true },
    updated_at: { type: "ref", columnType: "timestamp", autoUpdatedAt: true },

    transactions: { collection: "apitransaction", via: "subscription_id" },
    usage_logs: { collection: "apiusagelog", via: "subscription_id" }
  }
};
