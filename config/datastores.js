module.exports.datastores = {
  default: {
    // adapter: 'sails-postgresql',
    // url: 'mysql://user:password@host:port/database',
    // timezone: '+0',
    // BASE DE DATOS ACCESO APLICACION
    adapter: "sails-postgresql",
    url: "postgresql://CoreApiDBa:Z9E7xMd-ixHw8UH@HOST/CoreApiDB",
    timezone: "+0",
  },
  CoreApiDB: {
    adapter: "sails-postgresql",
    url: "postgresql://CoreApiDBa:Z9E7xMd-ixHw8UH@HOST/CoreApiDB",
    timezone: "+0",
  },
};