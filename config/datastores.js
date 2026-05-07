require('dotenv').config();

module.exports.datastores = {
  default: {
    adapter: 'sails-postgresql',
    url: process.env.DATABASE_URL,
    timezone: '+0'
  },

  CoreApiDB: {
    adapter: 'sails-postgresql',
    url: process.env.DATABASE_URL,
    timezone: '+0'
  },
};
