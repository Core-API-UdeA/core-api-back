module.exports = async function (req, res, proceed) {
  sails.log.debug('\n==============================\n');
  sails.log.debug('\ttry-authenticated policy (JWT opcional)');
  sails.log.debug('\n==============================\n');

  // Si no hay cabecera Authorization, seguimos sin detener la petición
  if (!req.headers.authorization) {
    sails.log.verbose('No authorization header found, proceeding as guest');
    return proceed();
  }

  try {
    const [prefix, token] = req.headers.authorization.split(' ');

    if (prefix !== 'Bearer' || !token) {
      sails.log.warn('Invalid authorization header format');
      return proceed(); // no bloquea, simplemente no carga usuario
    }

    const decoded = await sails.helpers.auth.verifyJwtToken.with({ token });

    if (decoded) {
      // Guardamos el usuario decodificado en la request

      req.me = {
        id: decoded.user.id,
        email: decoded.user.email,
        rol: decoded.user.rol,
      };
      sails.log.verbose(`Usuario autenticado opcionalmente: ${decoded.email}`);
    } else {
      sails.log.warn('Token inválido o expirado, continuando sin usuario');
    }
  } catch (error) {
    sails.log.warn('Error procesando token opcional:', error.message);
  }

  return proceed();
};
