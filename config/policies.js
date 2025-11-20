module.exports.policies = {
  /***************************************************************************
   *                                                                          *
   * Default policy for all controllers and actions, unless overridden.       *
   * (`true` allows public access)                                            *
   *                                                                          *
   ***************************************************************************/

  "*": ["auth/is-authenticated"],

  "auth/fetch": "auth/ok-fetch",
  "auth/login": "auth/validate-login-params",
  "auth/google-login": true,
  "auth/github-login": true,
  'auth/register': 'auth/validate-register-params',
  'auth/confirmate': true,
  'webhooks/mercadopago': true,

  "catalogo/listar-apis": ['auth/try-authenticated'],
  "catalogo/obtener-api-overview": ['auth/try-authenticated'],
  "catalogo/obtener-api-documentation": ['auth/try-authenticated'],
  "catalogo/listar-planes": ['auth/try-authenticated'],
};
