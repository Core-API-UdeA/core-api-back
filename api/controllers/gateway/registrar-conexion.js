/**
 * api/controllers/gateway/registrar-conexion.js
 *
 * Recibe los datos del formulario "Conexión con tu API" del frontend
 * y orquesta el registro seguro de la conexión del proveedor.
 *
 * Ruta:   POST /gateway/conexion
 * Policy: auth/is-authenticated
 */

module.exports = {
  friendlyName: 'Registrar conexión de API',

  description:
    'Guarda la configuración de conexión del proveedor con credenciales ' +
    'cifradas y verifica la conectividad con el servicio original.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      description: 'UUID de la API que se está configurando.',
    },
    baseUrl: {
      type: 'string',
      required: true,
      maxLength: 500,
      description: 'URL base del servicio real. Ej: https://api.openweathermap.org/data/2.5',
    },
    authType: {
      type: 'string',
      required: true,
      isIn: ['none', 'api_key', 'bearer', 'oauth2'],
      description: 'Mecanismo de autenticación que requiere el servicio del proveedor.',
    },
    credential: {
      type: 'ref',
      description: 'Token o API key del proveedor. Se cifra con AES-256-GCM antes de guardar.',
    },
    apiKeyHeaderName: {
      type: 'ref',
      description: 'Nombre del header para la API key. Solo aplica si authType = "api_key".',
    },
    healthCheckEndpoint: {
      type: 'ref',
      description: 'Ruta relativa del endpoint de prueba. Ej: /health, /monitoreo, /',
    },
    healthCheckMethod: {
      type: 'ref',
      defaultsTo: 'GET',
    },
  },

  exits: {
    success: {
      description: 'Conexión registrada. Incluye resultado del health check.',
      responseType: 'okResponse',
    },
    errorGeneral: {
      description: 'Error al registrar la conexión.',
      responseType: 'nokResponse',
    },
    badRequest: {
      description: 'Parámetros inválidos.',
      responseType: 'badRequest',
    },
  },

  fn: async function (
    { apiId, baseUrl, authType, credential, apiKeyHeaderName, healthCheckEndpoint, healthCheckMethod },
    exits
  ) {
    sails.log.verbose('-----> Controller: Registrar conexión | apiId:', apiId);

    try {
      if (authType !== 'none' && !credential) {
        return exits.badRequest(
          `Se requiere el campo "credential" cuando authType es "${authType}".`
        );
      }

      const resultado = await sails.helpers.gateway.guardarConexion.with({
        apiId,
        ownerId: this.req.decoded.sub,
        datosConexion: {
          baseUrl,
          authType,
          credential: credential || null,
          apiKeyHeaderName,
          healthCheckEndpoint,
          healthCheckMethod,
        },
      });

      const { conexion, healthCheck } = resultado;

      const mensajeEstado = healthCheck.ok
        ? 'Conexión registrada y conectividad verificada correctamente.'
        : `Conexión guardada pero la verificación falló: ${healthCheck.error || `HTTP ${healthCheck.statusCode}`}`;

      return exits.success({
        mensaje: mensajeEstado,
        data: {
          conexionId: conexion.id,
          apiId: conexion.api_id,
          status: conexion.status,
          authType: conexion.auth_type,
          baseUrl: conexion.base_url,
          healthCheck: {
            ok: healthCheck.ok,
            statusCode: healthCheck.statusCode,
            latencyMs: healthCheck.latencyMs,
            error: healthCheck.error,
          },
        },
      });

    } catch (error) {
      sails.log.error('Error en controller registrar-conexion:', error);

      if (error.code === 'E_API_NO_ENCONTRADA') {
        return exits.errorGeneral('La API no existe o no tienes permiso para configurarla.');
      }

      return exits.errorGeneral(error.message || 'Error al registrar la conexión. Intenta nuevamente.');
    }
  },
};
