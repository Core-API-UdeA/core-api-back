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
  "GET /auth/fetch": { action: "auth/fetch" },
  "POST /auth/register": { action: "auth/register" },

  // RUTA DE MONITOREO DE LA API
  'GET /': (req, res) => {
    return res.send('¡API externa levantada y respondiendo!');
  },

});
