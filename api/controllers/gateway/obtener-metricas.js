/**
 * api/controllers/gateway/obtener-metricas.js
 *
 * Entrega las métricas de uso de una API para el panel del proveedor.
 * Corresponde a la vista "Métricas de uso | Últimos X días" del frontend.
 *
 * Ruta:   GET /gateway/metricas/:apiId
 * Policy: auth/is-authenticated
 */

module.exports = {
  friendlyName: 'Obtener métricas de API',

  description: 'Retorna KPIs, gráficos y rankings de uso para el panel del proveedor.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      description: 'UUID de la API a consultar.',
    },
    diasAtras: {
      type: 'number',
      required: false,
      defaultsTo: 7,
      description: 'Período en días: 7, 30, 90. Por defecto 7 (últimos 7 días).',
    },
  },

  exits: {
    success: {
      description: 'Métricas obtenidas exitosamente.',
      responseType: 'okResponse',
    },
    notFound: {
      description: 'API no encontrada o sin permiso.',
      responseType: 'nokResponse',
    },
    errorGeneral: {
      description: 'Error inesperado al obtener métricas.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ apiId, diasAtras }, exits) {
    sails.log.verbose('-----> Controller: Obtener métricas | apiId:', apiId);

    try {
      const metricas = await sails.helpers.gateway.obtenerMetricas.with({
        apiId,
        ownerId: this.req.decoded.sub,
        diasAtras,
      });

      return exits.success({
        mensaje: 'Métricas obtenidas exitosamente.',
        data: metricas,
      });

    } catch (error) {
      sails.log.error('Error al obtener métricas:', error);

      if (error.code === 'E_API_NO_ENCONTRADA') {
        return exits.notFound({
          mensaje: 'La API no existe o no tienes permiso para verla.',
        });
      }

      return exits.errorGeneral({
        mensaje: error.message || 'Error al obtener las métricas.',
      });
    }
  },
};
