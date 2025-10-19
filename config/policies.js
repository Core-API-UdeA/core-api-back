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
  "catalogo/listar-apis": true,
  'auth/register': 'auth/validate-register-params',
  'auth/confirmate': true,
};
