/**
 * Custom configuration
 * (sails.config.custom)
 *
 * One-off settings specific to your application.
 *
 * For more information on custom configuration, visit:
 * https://sailsjs.com/config/custom
 */
var local = require("./local");

module.exports.custom = {

  /***************************************************************************
  *                                                                          *
  * Any other custom config this Sails app should use during development.    *
  *                                                                          *
  ***************************************************************************/
  // sendgridSecret: 'SG.fake.3e0Bn0qSQVnwb1E4qNPz9JZP5vLZYqjh7sn8S93oSHU',
  // stripeSecret: 'sk_test_Zzd814nldl91104qor5911gjald',
  // …

  /***************************************************************************
  *  GATEWAY - Clave de cifrado para credenciales de proveedores             *
  *                                                                          *
  *  Genera una con:                                                         *
  *  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"*
  *                                                                          *
  *  ⚠️  NUNCA commitear la clave real. Usar variables de entorno en prod.   *
  *  En producción: process.env.GATEWAY_ENCRYPTION_KEY                       *
  ***************************************************************************/
  gatewayEncryptionKey: local.GATEWAY_ENCRYPTION_KEY || '',

};
