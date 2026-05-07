const _ = require("lodash");

module.exports = function nokResponse(mensaje) {
  sails.log.debug("\n--------> nokResponse()\n\n");
  sails.log.error("\nDetalle del error: ", mensaje, '\n');

  var res = this.res;

  var statusCodeToSet = 200;

  let ejecucion = {
    respuesta: {
      estado: "NOK",
      mensaje: mensaje || "Error en la ejecución",
    },
    error: new Error(mensaje),
  };

  return res.status(statusCodeToSet).send({ ejecucion: ejecucion });
};
