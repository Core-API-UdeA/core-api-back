module.exports = {
  datastore: "CoreApiDB",
  tableName: "api_transactions",

  attributes: {
    id: { type: "string", columnType: "uuid", required: true },
    user_id: { model: "user", required: true },
    api_id: { model: "api", required: true },
    subscription_id: { model: "apisubscription" },
    plan_id: { model: "apiplan", required: true },

    transaction_type: {
      type: "string",
      isIn: ["purchase", "renewal", "upgrade", "downgrade", "refund"],
      required: true,
    },

    amount: { type: "number", columnType: "numeric", required: true },
    currency: { type: "string", defaultsTo: "USD" },
    tax_amount: { type: "number", columnType: "numeric", defaultsTo: 0 },
    total_amount: { type: "number", columnType: "numeric", required: true },

    platform_fee: { type: "number", columnType: "numeric", defaultsTo: 0 },
    owner_payout: { type: "number", columnType: "numeric", required: true },

    payment_status: {
      type: "string",
      isIn: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
        "cancelled",
      ],
      defaultsTo: "pending",
    },

    payment_provider: {
      type: "string",
      isIn: ["stripe", "paypal", "mercadopago"],
      required: true,
    },
    payment_provider_transaction_id: { type: "string", allowNull: true },
    payment_provider_checkout_id: { type: "string", allowNull: true },

    checkout_url: { type: "string", allowNull: true },
    success_url: { type: "string", allowNull: true },
    cancel_url: { type: "string", allowNull: true },

    description: { type: "string" },
    metadata: { type: "json" },
    payment_metadata: { type: "json" },

    transaction_date: { type: "ref", columnType: "timestamp", required: true },
    completed_at: { type: "ref", columnType: "timestamp" },
    refunded_at: { type: "ref", columnType: "timestamp" },
    expires_at: { type: "ref", columnType: "timestamp" },

    created_at: { type: "ref", columnType: "timestamp", autoCreatedAt: true },
    updated_at: { type: "ref", columnType: "timestamp", autoUpdatedAt: true },
  },
};
