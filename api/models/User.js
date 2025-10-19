module.exports = {
  datastore: "CoreApiDB",
  tableName: "users",

  attributes: {
    email: {
      type: "string",
      required: true,
      maxLength: 80,
      isEmail: true,
      unique: true,
    },

    password: {
      type: "string",
      required: true,
      protect: true,
      maxLength: 255,
    },

    estado: {
      type: "string",
      isIn: ['Unconfirmed', 'Change-requested', 'Confirmed'],
      defaultsTo: 'Unconfirmed',
      allowNull: true,
    },

    rol: {
      type: "string",
      isIn: ['usuario', 'admin'],
      defaultsTo: 'usuario',
      allowNull: true,
    },

    username: {
      type: "string",
      required: true,
      maxLength: 60,
    },

    password_reset_token: {
      type: 'string',
      allowNull: true,
      maxLength: 255,
    },

    password_reset_token_expired_at: {
      type: 'number',
      allowNull: true,
      columnType: 'double',
    },

    last_seen_at: {
      type: 'string',
      allowNull: true,
      columnType: 'bigint',
    },

    emailConfirmationToken: {
      type: 'string',
      allowNull: true,
      description:
        'Un token único utilizado para verificar la dirección de correo electrónico del usuario.',
    },

    emailConfirmationTokenExpiresAt: {
      type: 'number',
      allowNull: true,
      description:
        'Un JS timestamp que representa el momento en que `emailConfirmationToken` expira.',
    },
  },

  primaryKey: 'id',

  customToJSON: function () {
    return _.omit(this, [
      "password",
      "password_reset_token",
      "password_reset_token_expired_at",
    ]);
  },
};
