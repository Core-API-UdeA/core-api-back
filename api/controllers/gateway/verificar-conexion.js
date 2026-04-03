/**
 * api/controllers/gateway/verificar-conexion.js
 *
 * Prueba la conectividad con un servicio externo SIN guardar nada en BD.
 * Corresponde al botón "Test connection" del formulario del frontend.
 *
 * Si se pasa apiId, actualiza last_checked_at y status en api_connections.
 *
 * Ruta:   POST /gateway/conexion/verificar
 * Policy: auth/is-authenticated
 */

module.exports = {
  friendlyName: 'Verificar conexión con servicio externo',

  description:
    'Realiza un health check contra la URL indicada y retorna ' +
    'el resultado sin persistir cambios en las credenciales.',

  inputs: {
    baseUrl: {
      type: 'string',
      required: true,
      maxLength: 500,
      description: 'URL base del servicio a verificar.',
    },
    authType: {
      type: 'string',
      required: false,
      isIn: ['none', 'api_key', 'bearer', 'oauth2'],
      defaultsTo: 'none',
    },
    credential: {
      type: 'string',
      required: false,
      maxLength: 2000,
      description: 'Credencial en texto plano solo para la prueba. No se persiste.',
    },
    apiKeyHeaderName: {
      type: 'string',
      required: false,
      defaultsTo: 'X-Api-Key',
    },
    healthCheckEndpoint: {
      type: 'string',
      required: false,
      maxLength: 300,
      defaultsTo: '/',
    },
    healthCheckMethod: {
      type: 'string',
      required: false,
      isIn: ['GET', 'POST', 'HEAD'],
      defaultsTo: 'GET',
    },
    // Opcional: si se pasa, actualiza el estado de la conexión registrada
    apiId: {
      type: 'string',
      required: false,
      description: 'UUID de la API. Si se pasa, actualiza el estado de su conexión en BD.',
    },
  },

  exits: {
    success: {
      description: 'Resultado del health check.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Error al ejecutar la verificación.',
      responseType: 'nokResponse',
    },
  },

  fn: async function (
    { baseUrl, authType, credential, apiKeyHeaderName, healthCheckEndpoint, healthCheckMethod, apiId },
    exits
  ) {
    sails.log.verbose('-----> Controller: Verificar conexión |', baseUrl);

    try {
      const healthResult = await sails.helpers.gateway.validarConectividad.with({
        baseUrl,
        healthCheckEndpoint,
        healthCheckMethod,
        authType,
        credentialPlaintext: credential || '',
        apiKeyHeaderName,
      });

      // Si viene apiId, actualizar estado de la conexión ya registrada
      if (apiId) {
        const conexionExistente = await ApiConnection.findOne({ api_id: apiId });

        if (conexionExistente) {
          await ApiConnection.updateOne({ id: conexionExistente.id }).set({
            status: healthResult.ok ? 'active' : 'failed',
            last_checked_at: new Date(),
            last_check_status_code: healthResult.statusCode,
            last_check_latency_ms: healthResult.latencyMs,
            updated_at: new Date(),
          });
          sails.log.verbose('Estado de conexión actualizado para apiId:', apiId, '->', healthResult.ok ? 'active' : 'failed');
        }
      }

      const mensaje = healthResult.ok
        ? `Conexión exitosa. El servicio respondió con HTTP ${healthResult.statusCode} en ${healthResult.latencyMs}ms.`
        : `El servicio no respondió correctamente. ${healthResult.error || `HTTP ${healthResult.statusCode}`}`;

      return exits.success({
        mensaje,
        data: {
          ok: healthResult.ok,
          statusCode: healthResult.statusCode,
          latencyMs: healthResult.latencyMs,
          error: healthResult.error,
        },
      });

    } catch (error) {
      sails.log.error('Error en controller verificar-conexion:', error);
      return exits.errorGeneral(error.message || 'Error al ejecutar la verificación de conectividad.');
    }
  },
};
