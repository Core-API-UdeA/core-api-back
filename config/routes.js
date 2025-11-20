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

  // RUTAS DE MANEJO DEL CATALOGO

  "PUT /catalogo/favorite": { action: "catalogo/actualizar-favorito" },
  "PUT /catalogo/rating": { action: "catalogo/actualizar-rating" },
  "PUT /catalogo/views": { action: "catalogo/actualizar-views" },
  "GET /catalogo/listarapis": { action: "catalogo/listar-apis" },
  "GET /catalogo/obtenerdocumentacion": {
    action: "catalogo/obtener-api-documentation",
  },
  "GET /catalogo/obteneroverview": { action: "catalogo/obtener-api-overview" },
  "GET /catalogo/obteneruserinteraction": {
    action: "catalogo/obtener-user-interaction",
  },
  "POST /catalogo/registrarapioverview": {
    action: "catalogo/registrar-api-overview",
  },
  "POST /catalogo/registrardocumentacion": {
    action: "catalogo/registrar-api-documentation",
  },
  "GET /catalogo/planes": "catalogo/listar-planes",
  "POST /catalogo/planes": "catalogo/gestionar-plan",
  "PUT /catalogo/planes/:planId": "catalogo/gestionar-plan",

  // PAGOS

  "POST /pagos/crear-checkout": "pagos/crear-checkout",
  "GET /pagos/transaccion/:transactionId": "pagos/consultar-transaccion",
  "GET /pagos/mis-transacciones": "pagos/listar-transacciones",

  // WEBHOOKS

  "POST /webhooks/mercadopago": "webhooks/mercadopago",
  "GET /webhooks/mercadopago": "webhooks/mercadopago",

  // SUSCRIPCIONES

  "GET /suscripciones/mis-suscripciones":
    "suscripciones/listar-suscripciones",
  "PUT /suscripciones/cancelar/:subscriptionId":
    "suscripciones/cancelar-suscripcion",

  // RUTA DE MONITOREO DE LA API

  "GET /": (req, res) => {
    return res.send("¡API externa levantada y respondiendo!");
  },
});
