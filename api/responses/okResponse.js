const fs = require('fs');
const path = require('path');

module.exports = function okResponse({ mensaje, data, archivo, opciones = {} }) {
  sails.log.debug("\n--------> okResponse()\n\n");
  sails.log.verbose('\nDetalle de la respuesta: ', mensaje, data, archivo, opciones, '\n');

  var res = this.res;

  var statusCodeToSet = opciones.statusCode || 200;

  let ejecucion = {
    respuesta: {
      estado: 'OK',
      mensaje: mensaje || 'Ejecución satisfactoria',
    },
    data: data || {},
  };

  if (archivo && archivo.blob) {
    const buffer = Buffer.from(archivo.blob, 'base64');
    res.setHeader('Content-Type', archivo.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${archivo.filename || 'file'}"`);
    return res.status(statusCodeToSet).send(buffer);
  }

  if (opciones.headers) {
    for (const [key, value] of Object.entries(opciones.headers)) {
      res.setHeader(key, value);
    }
  }

  if (!data) {
    delete ejecucion.data;
  }

  return res.status(statusCodeToSet).send({ ejecucion: ejecucion });
};
