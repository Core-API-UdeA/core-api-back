/**
 * api/controllers/gateway/obtener-conexion.js
 *
 * Retorna la configuración de conexión actual de una API (sin la credencial
 * cifrada). Usado por el frontend para mostrar el resumen de conexión y
 * permitir su edición desde el panel de gestión de la API.
 *
 * Ruta:   GET /gateway/conexion/:apiId
 * Policy: auth/is-authenticated
 */

module.exports = {
  friendlyName: 'Obtener conexión de API',

  description:
    'Retorna los datos de conexión de una API (base_url, auth_type, ' +
    'health check, status), excluyendo la credencial cifrada por seguridad.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      description: 'UUID de la API a consultar.',
    },
  },

  exits: {
    success: {
      description: 'Conexión obtenida exitosamente.',
      responseType: 'okResponse',
    },
    notFound: {
      description: 'No existe conexión configurada para esta API.',
      responseType: 'nokResponse',
    },
    forbidden: {
      description: 'El usuario no es propietario de la API.',
      responseType: 'nokResponse',
    },
    errorGeneral: {
      description: 'Error inesperado.',
      responseType: 'nokResponse',
    },
  },

  fn: async function ({ apiId }, exits) {
    sails.log.verbose('-----> Controller: Obtener conexión | apiId:', apiId);

    try {
      // Verificar ownership: solo el dueño de la API puede ver su conexión.
      const api = await Api.findOne({ id: apiId });

      if (!api) {
        return exits.notFound({
          mensaje: 'La API no existe.',
        });
      }

      const userId = this.req.decoded.sub;
      if (api.owner_id !== userId) {
        return exits.forbidden({
          mensaje: 'No tienes permiso para ver la conexión de esta API.',
        });
      }

      // Obtener la conexión más reciente
      const connection = await ApiConnection.findOne({ api_id: apiId });

      if (!connection) {
        return exits.notFound({
          mensaje: 'Esta API aún no tiene conexión configurada.',
        });
      }

      // Retornar SOLO datos seguros (sin credentials_encrypted)
      return exits.success({
        mensaje: 'Conexión obtenida exitosamente.',
        data: {
          id:                       connection.id,
          api_id:                   connection.api_id,
          base_url:                 connection.base_url,
          auth_type:                connection.auth_type,
          api_key_header_name:      connection.api_key_header_name,
          health_check_endpoint:    connection.health_check_endpoint,
          health_check_method:      connection.health_check_method,
          status:                   connection.status,
          last_checked_at:          connection.last_checked_at,
          last_check_status_code:   connection.last_check_status_code,
          last_check_latency_ms:    connection.last_check_latency_ms,
          // Indicador de si tiene credencial cifrada (sin exponer el valor)
          has_credential:           !!connection.credentials_encrypted,
          created_at:               connection.created_at,
          updated_at:               connection.updated_at,
        },
      });

    } catch (error) {
      sails.log.error('Error al obtener conexión:', error);
      return exits.errorGeneral({
        mensaje: error.message || 'Error al obtener la conexión.',
      });
    }
  },
};
