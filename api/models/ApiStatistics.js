module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_statistics",

  attributes: {
    id: { type: 'string', columnType: 'uuid', required: true },
    api_id: { model: "api", required: true },

    period_type: {
      type: "string",
      isIn: ["daily", "weekly", "monthly", "yearly"],
      required: true
    },
    period_start: { type: "ref", columnType: "date", required: true },
    period_end: { type: "ref", columnType: "date", required: true },

    total_requests: { type: "number", defaultsTo: 0 },
    successful_requests: { type: "number", defaultsTo: 0 },
    failed_requests: { type: "number", defaultsTo: 0 },
    avg_response_time_ms: { type: "number", columnType: "numeric", defaultsTo: 0 },

    unique_users: { type: "number", defaultsTo: 0 },
    new_subscriptions: { type: "number", defaultsTo: 0 },
    cancelled_subscriptions: { type: "number", defaultsTo: 0 },
    active_subscriptions: { type: "number", defaultsTo: 0 },

    total_revenue: { type: "number", columnType: "numeric", defaultsTo: 0 },
    total_transactions: { type: "number", defaultsTo: 0 },
    avg_transaction_value: { type: "number", columnType: "numeric", defaultsTo: 0 },

    total_views: { type: "number", defaultsTo: 0 },
    total_favorites: { type: "number", defaultsTo: 0 },
    avg_rating: { type: "number", columnType: "numeric", defaultsTo: 0 },
    total_ratings: { type: "number", defaultsTo: 0 },

    created_at: { type: "ref", columnType: "timestamp", autoCreatedAt: true }
  }
};
