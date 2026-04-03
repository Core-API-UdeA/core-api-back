/**
 * api/helpers/gateway/registrar-conexion.js
 *
 * Persiste la configuración de conexión del proveedor en api_connections.
 * Responsabilidades:
 *   1. Verificar ownership de la API
 *   2. Generar el slug si la API aún no tiene uno
 *   3. Cifrar las credenciales antes de guardar
 *   4. Ejecutar la validación de conectividad
 *   5. Crear o actualizar el registro en api_connections
 */

module.exports = {
  friendlyName: 'Registrar conexión de API',

  description:
    'Cifra las credenciales del proveedor, valida conectividad y ' +
    'persiste la configuración en api_connections.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      description: 'UUID de la API en la tabla apis.',
    },
    ownerId: {
      type: 'string',
      required: true,
      description: 'UUID del usuario dueño de la API.',
    },
    datosConexion: {
      type: 'json',
      required: true,
      description: 'Objeto con los datos de conexión del proveedor.',
      example: {
        baseUrl: 'https://api.openweathermap.org/data/2.5',
        authType: 'api_key',
        credential: 'abc123secretkey',
        apiKeyHeaderName: 'X-Api-Key',
        healthCheckEndpoint: '/weather',
        healthCheckMethod: 'GET',
      },
    },
  },

  fn: async function ({ apiId, ownerId, datosConexion }) {
    sails.log.verbose('-----> Helper: Registrar conexión | apiId:', apiId);
    const flaverr = require('flaverr');

    try {
      // ─── 1. Verificar ownership ───────────────────────────────────────────
      const api = await Api.findOne({ id: apiId, owner_id: ownerId });

      if (!api) {
        throw flaverr(
          { code: 'E_API_NO_ENCONTRADA' },
          new Error('La API no existe o no tienes permiso para configurarla.')
        );
      }

      const {
        baseUrl,
        authType = 'none',
        credential = null,
        apiKeyHeaderName = 'X-Api-Key',
        healthCheckEndpoint = '/',
        healthCheckMethod = 'GET',
      } = datosConexion;

      // ─── 2. Generar slug si la API aún no lo tiene ───────────────────────
      if (!api.slug) {
        const slug = _generarSlug(api.title);
        await Api.updateOne({ id: apiId }).set({ slug, updated_at: new Date() });
        sails.log.verbose('Slug generado:', slug);
      }

      // ─── 3. Cifrar credenciales ──────────────────────────────────────────
      let credencialesCifradas = null;

      if (authType !== 'none' && credential) {
        credencialesCifradas = await sails.helpers.gateway.cifrarCredenciales.with({
          accion: 'cifrar',
          valor: credential,
        });
      }

      // ─── 4. Validar conectividad ─────────────────────────────────────────
      const healthResult = await sails.helpers.gateway.validarConectividad.with({
        baseUrl,
        healthCheckEndpoint,
        healthCheckMethod,
        authType,
        credentialPlaintext: credential || '',
        apiKeyHeaderName,
      });

      sails.log.verbose(
        'Health check:', healthResult.ok ? 'OK' : 'FALLO',
        '| latencia:', healthResult.latencyMs + 'ms'
      );

      // ─── 5. Crear o actualizar api_connections ───────────────────────────
      const existente = await ApiConnection.findOne({ api_id: apiId });

      const datosAGuardar = {
        api_id: apiId,
        base_url: baseUrl,
        auth_type: authType,
        credentials_encrypted: credencialesCifradas,
        api_key_header_name: apiKeyHeaderName,
        health_check_endpoint: healthCheckEndpoint,
        health_check_method: healthCheckMethod,
        status: healthResult.ok ? 'active' : 'failed',
        last_checked_at: new Date(),
        last_check_status_code: healthResult.statusCode,
        last_check_latency_ms: healthResult.latencyMs,
        updated_at: new Date(),
      };

      let conexion;

      if (existente) {
        conexion = await ApiConnection.updateOne({ id: existente.id }).set(datosAGuardar);
        sails.log.verbose('ApiConnection actualizada:', existente.id);
      } else {
        conexion = await ApiConnection.create({
          ...datosAGuardar,
          created_at: new Date(),
        }).fetch();
        sails.log.verbose('ApiConnection creada:', conexion.id);
      }

      return {
        conexion,
        healthCheck: {
          ok: healthResult.ok,
          statusCode: healthResult.statusCode,
          latencyMs: healthResult.latencyMs,
          error: healthResult.error,
        },
      };

    } catch (error) {
      sails.log.error('Error en helper registrar-conexion:', error);

      if (error.code === 'E_API_NO_ENCONTRADA') {
        throw error;
      }

      throw flaverr(
        { code: 'E_REGISTRAR_CONEXION', message: 'Error al registrar la conexión' },
        error
      );
    }
  },
};

// ─── Utilidad privada ─────────────────────────────────────────────────────────

function _generarSlug(titulo) {
  return titulo
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 160);
}
