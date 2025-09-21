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
  'auth/register': 'auth/validate-register-params'
};
