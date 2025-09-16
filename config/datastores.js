module.exports.datastores = {
  default: {
    // adapter: 'sails-postgresql',
    // url: 'mysql://user:password@host:port/database',
    // timezone: '+0',
    // BASE DE DATOS ACCESO APLICACION
    adapter: "sails-postgresql",
    url: "postgresql://CoreApiDBa:Z9E7xMd-ixHw8UH@localhost:5432/CoreApiDB",
    timezone: "+0",

  },
  CoreApiDB: {
    adapter: "sails-postgresql",
    url: process.env.DATABASE_URL || 'postgresql://CoreApiDBa:Z9E7xMd-ixHw8UH@localhost:5432/CoreApiDB',
    timezone: "+0",
  },
};
