var local = require("./local");

var ROUTE_PREFIX = local.prefix || "";

function addGlobalPrefix(routes) {
  var paths = Object.keys(routes);
  var newRoutes = {};

  if (ROUTE_PREFIX === "") {
    return routes;
  }

  paths.forEach((path) => {
    var pathParts = path.split(" ");
    var uri = pathParts.pop();
    var prefixedURI = "";
    var newPath = "";

    prefixedURI = ROUTE_PREFIX + uri;

    pathParts.push(prefixedURI);

    newPath = pathParts.join(" ");
    newRoutes[newPath] = routes[path];
  });

  return newRoutes;
}

module.exports.routes = addGlobalPrefix({
  // RUTAS DE AUTENTICACIÓN

  "POST /auth/login": { action: "auth/login" },
  "POST /auth/google-login": { action: "auth/google-login" },
  "POST /auth/github-login": { action: "auth/github-login" },
  "GET /auth/fetch": { action: "auth/fetch" },
  "POST /auth/register": { action: "auth/register" },
  "POST /auth/confirmation": { action: "auth/confirmate" },
  "POST /auth/forgot-password": { action: "auth/forgot-password" },

  'POST /catalogo/favorite': { action: 'catalogo/actualizar-favorito' },
  'POST /catalogo/rating': { action: 'catalogo/actualizar-rating' },
  "GET /catalogo/listarapis": { action: "catalogo/listar-apis" },
  "GET /catalogo/obtenerdocumentacion": { action: "catalogo/obtener-api-documentation" },

  // RUTA DE MONITOREO DE LA API
  'GET /': (req, res) => {
    return res.send('¡API externa levantada y respondiendo!');
  },

});
