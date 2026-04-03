/**
 * api/helpers/gateway/validar-conectividad.js
 *
 * Realiza una solicitud de prueba al servicio del proveedor para verificar
 * que está disponible antes de activar la conexión.
 *
 * Retorna: { ok, statusCode, latencyMs, error }
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = {
  friendlyName: 'Validar conectividad con servicio del proveedor',

  description:
    'Hace una solicitud de prueba al endpoint de salud configurado y ' +
    'retorna si el servicio está disponible.',

  inputs: {
    baseUrl: {
      type: 'string',
      required: true,
      description: 'URL base del servicio del proveedor.',
    },
    healthCheckEndpoint: {
      type: 'string',
      required: false,
      defaultsTo: '/',
    },
    healthCheckMethod: {
      type: 'string',
      required: false,
      defaultsTo: 'GET',
      isIn: ['GET', 'POST', 'HEAD'],
    },
    authType: {
      type: 'string',
      required: false,
      defaultsTo: 'none',
      isIn: ['none', 'api_key', 'bearer', 'oauth2'],
    },
    credentialPlaintext: {
      type: 'string',
      required: false,
      defaultsTo: '',
      description: 'Credencial en texto plano solo para la prueba. No se persiste.',
    },
    apiKeyHeaderName: {
      type: 'string',
      required: false,
      defaultsTo: 'X-Api-Key',
    },
  },

  fn: async function ({
    baseUrl,
    healthCheckEndpoint,
    healthCheckMethod,
    authType,
    credentialPlaintext,
    apiKeyHeaderName,
  }) {
    sails.log.verbose('-----> Helper: Validar conectividad |', healthCheckMethod, baseUrl + healthCheckEndpoint);

    const inicio = Date.now();

    try {
      const base = baseUrl.replace(/\/$/, '');
      const ruta = healthCheckEndpoint.startsWith('/') ? healthCheckEndpoint : '/' + healthCheckEndpoint;
      const urlDestino = new URL(base + ruta);

      const esHttps = urlDestino.protocol === 'https:';
      const lib = esHttps ? https : http;

      const headers = {
        'User-Agent': 'CoreAPI-HealthCheck/1.0',
        'Accept': 'application/json, text/plain, */*',
      };

      if (credentialPlaintext && authType !== 'none') {
        if (authType === 'bearer' || authType === 'oauth2') {
          headers['Authorization'] = `Bearer ${credentialPlaintext}`;
        } else if (authType === 'api_key') {
          headers[apiKeyHeaderName || 'X-Api-Key'] = credentialPlaintext;
        }
      }

      const resultado = await new Promise((resolve) => {
        const opciones = {
          hostname: urlDestino.hostname,
          port: urlDestino.port || (esHttps ? 443 : 80),
          path: urlDestino.pathname + urlDestino.search,
          method: healthCheckMethod,
          headers,
          timeout: 10000,
        };

        const req = lib.request(opciones, (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 400,
              statusCode: res.statusCode,
              latencyMs: Date.now() - inicio,
              error: null,
            });
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            ok: false,
            statusCode: null,
            latencyMs: Date.now() - inicio,
            error: 'Timeout: el servicio no respondió en 10 segundos.',
          });
        });

        req.on('error', (err) => {
          resolve({
            ok: false,
            statusCode: null,
            latencyMs: Date.now() - inicio,
            error: err.message,
          });
        });

        req.end();
      });

      sails.log.verbose(
        'Resultado health check:',
        resultado.ok ? 'OK' : 'FALLO',
        '| status:', resultado.statusCode,
        '| latencia:', resultado.latencyMs + 'ms'
      );

      return resultado;

    } catch (err) {
      sails.log.error('Error inesperado en validar-conectividad:', err.message);
      return {
        ok: false,
        statusCode: null,
        latencyMs: Date.now() - inicio,
        error: err.message,
      };
    }
  },
};
