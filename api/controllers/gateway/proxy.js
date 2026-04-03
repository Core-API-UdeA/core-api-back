/**
 * api/controllers/gateway/proxy.js
 *
 * Controlador principal del API Gateway de CoreAPI.
 *
 * Flujo de cada solicitud:
 *  1. Extraer apiSlug y subruta del path
 *  2. Buscar la ApiConnection activa para ese slug
 *  3. Verificar suscripción activa del consumidor y cuota del plan
 *  4. Registrar pre-métrica en ApiUsageLog
 *  5. Descifrar credenciales del proveedor y hacer el proxy HTTP
 *  6. Actualizar métrica con status_code y latencia
 *  7. Retransmitir la respuesta al consumidor
 *
 * Ruta:   ALL /gateway/:apiSlug/*
 * Policy: auth/is-authenticated
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

module.exports = {
  friendlyName: 'Gateway proxy',

  description: 'Recibe solicitudes de consumidores y las redirige al proveedor correspondiente.',

  inputs: {},

  exits: {
    success: { description: 'Solicitud procesada y respuesta retransmitida.' },
  },

  fn: async function (inputs, exits) {
    const req = this.req;
    const res = this.res;

    sails.log.verbose('-----> Gateway proxy | método:', req.method, '| path:', req.path);

    // ─── 1. Extraer apiSlug y subruta ─────────────────────────────────────
    const apiSlug = req.params.apiSlug;
    const prefixPattern = new RegExp(`^(/scapi)?/gateway/${apiSlug}/?`);
    const subruta = '/' + (req.path.replace(prefixPattern, '') || '');

    sails.log.verbose('apiSlug:', apiSlug, '| subruta:', subruta);

    // ─── 2. Buscar Api y su conexión activa ───────────────────────────────
    const api = await Api.findOne({ slug: apiSlug });

    if (!api) {
      sails.log.warn('Gateway: API no encontrada para slug:', apiSlug);
      return res.status(404).json({
        ejecucion: {
          respuesta: { estado: 'NOK', mensaje: `API '${apiSlug}' no encontrada en CoreAPI.` },
        },
      });
    }

    const apiConnection = await ApiConnection.findOne({ api_id: api.id, status: 'active' });

    if (!apiConnection) {
      sails.log.warn('Gateway: Sin conexión activa para api_id:', api.id);
      return res.status(503).json({
        ejecucion: {
          respuesta: { estado: 'NOK', mensaje: 'El servicio no está disponible en este momento. Intenta más tarde.' },
        },
      });
    }

    // ─── 3. Verificar suscripción y cuota ─────────────────────────────────
    const consumidorId = req.decoded.sub;

    const suscripcion = await ApiSubscription.findOne({
      user_id: consumidorId,
      api_id: api.id,
      status: 'active',
    }).populate('plan_id');

    if (!suscripcion) {
      sails.log.warn('Gateway: Sin suscripción activa. userId:', consumidorId, 'apiId:', api.id);
      return res.status(403).json({
        ejecucion: {
          respuesta: { estado: 'NOK', mensaje: 'No tienes una suscripción activa para esta API.' },
        },
      });
    }

    const plan = suscripcion.plan_id;
    if (plan && plan.max_requests_per_month !== null) {
      if (suscripcion.requests_used_this_month >= plan.max_requests_per_month) {
        sails.log.warn('Gateway: Cuota mensual agotada. userId:', consumidorId);
        return res.status(429).json({
          ejecucion: {
            respuesta: { estado: 'NOK', mensaje: 'Has alcanzado el límite de solicitudes de tu plan este mes.' },
          },
        });
      }
    }

    // ─── 4. Registrar pre-métrica ──────────────────────────────────────────
    const timestampInicio = Date.now();
    let usageLogId = null;

    try {
      const usageLog = await ApiUsageLog.create({
        subscription_id: suscripcion.id,
        api_id: api.id,
        user_id: consumidorId,
        method: req.method,
        endpoint_path: subruta,
        status_code: 0,
        response_time_ms: 0,
        ip_address: req.ip || req.headers['x-forwarded-for'] || null,
        user_agent: req.headers['user-agent'] || null,
        request_metadata: {
          query: req.query || {},
          headers_keys: Object.keys(req.headers),
        },
      }).fetch();

      usageLogId = usageLog.id;
    } catch (logError) {
      // Error en métricas NO detiene la solicitud del consumidor
      sails.log.error('Gateway: Error al crear ApiUsageLog:', logError.message);
    }

    // ─── 5. Descifrar credenciales y hacer el proxy ────────────────────────
    let credencial = null;

    if (apiConnection.auth_type !== 'none' && apiConnection.credentials_encrypted) {
      try {
        credencial = await sails.helpers.gateway.cifrarCredenciales.with({
          accion: 'descifrar',
          valor: apiConnection.credentials_encrypted,
        });
      } catch (decryptError) {
        sails.log.error('Gateway: Error al descifrar credenciales:', decryptError.message);
        await _actualizarMetrica(usageLogId, 500, Date.now() - timestampInicio, 'Error interno al procesar credenciales.');
        return res.status(500).json({
          ejecucion: {
            respuesta: { estado: 'NOK', mensaje: 'Error interno de configuración del servicio.' },
          },
        });
      }
    }

    const urlDestino      = _construirUrlDestino(apiConnection.base_url, subruta, req.query);
    const headersProveedor = _construirHeaders(req.headers, apiConnection, credencial);

    sails.log.verbose('Gateway: Proxy →', req.method, urlDestino);

    try {
      const { statusCode, headers: headersRespuesta, body } = await _hacerProxyRequest({
        method: req.method,
        url: urlDestino,
        headers: headersProveedor,
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : null,
      });

      const latenciaMs = Date.now() - timestampInicio;

      // ─── 6. Actualizar métrica post-respuesta ──────────────────────────
      await _actualizarMetrica(usageLogId, statusCode, latenciaMs, null);

      await ApiSubscription.updateOne({ id: suscripcion.id }).set({
        requests_used_this_month: suscripcion.requests_used_this_month + 1,
        requests_used_this_day:   suscripcion.requests_used_this_day + 1,
        updated_at: new Date(),
      });

      // ─── 7. Retransmitir respuesta ─────────────────────────────────────
      const HEADERS_BLOQUEADOS = new Set([
        'x-powered-by', 'server', 'transfer-encoding', 'connection',
        'keep-alive', 'proxy-authenticate', 'proxy-authorization',
        'te', 'trailers', 'upgrade',
      ]);

      Object.entries(headersRespuesta).forEach(([key, value]) => {
        if (!HEADERS_BLOQUEADOS.has(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      res.setHeader('X-CoreAPI-Latency-Ms', latenciaMs);
      res.setHeader('X-CoreAPI-Api-Slug', apiSlug);

      return res.status(statusCode).send(body);

    } catch (proxyError) {
      const latenciaMs = Date.now() - timestampInicio;
      sails.log.error('Gateway: Error al hacer proxy al proveedor:', proxyError.message);
      await _actualizarMetrica(usageLogId, 502, latenciaMs, proxyError.message);

      return res.status(502).json({
        ejecucion: {
          respuesta: { estado: 'NOK', mensaje: 'El servicio del proveedor no respondió correctamente. Intenta más tarde.' },
        },
      });
    }
  },
};

// ─── Funciones privadas ───────────────────────────────────────────────────────

function _construirUrlDestino(baseUrl, subruta, queryParams) {
  const base = baseUrl.replace(/\/$/, '');
  const ruta = subruta.startsWith('/') ? subruta : '/' + subruta;
  const url  = new URL(base + ruta);

  if (queryParams && Object.keys(queryParams).length > 0) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  return url.toString();
}

function _construirHeaders(headersOriginales, apiConnection, credencial) {
  const HEADERS_EXCLUIDOS = new Set([
    'host', 'authorization', 'cookie', 'x-forwarded-for',
    'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip',
    'connection', 'upgrade', 'proxy-authorization',
  ]);

  const headers = {};

  Object.entries(headersOriginales).forEach(([key, value]) => {
    if (!HEADERS_EXCLUIDOS.has(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  if (credencial) {
    switch (apiConnection.auth_type) {
      case 'bearer':
      case 'oauth2':
        headers['Authorization'] = `Bearer ${credencial}`;
        break;
      case 'api_key':
        headers[apiConnection.api_key_header_name || 'X-Api-Key'] = credencial;
        break;
    }
  }

  return headers;
}

function _hacerProxyRequest({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const esHttps   = parsedUrl.protocol === 'https:';
    const lib       = esHttps ? https : http;

    const opciones = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (esHttps ? 443 : 80),
      path:     parsedUrl.pathname + parsedUrl.search,
      method,
      headers:  { ...headers },
      timeout:  30000,
    };

    let bodyBuffer = null;
    if (body && typeof body === 'object') {
      bodyBuffer = Buffer.from(JSON.stringify(body), 'utf8');
      opciones.headers['Content-Type']   = opciones.headers['content-type'] || 'application/json';
      opciones.headers['Content-Length'] = bodyBuffer.length;
    } else if (typeof body === 'string') {
      bodyBuffer = Buffer.from(body, 'utf8');
      opciones.headers['Content-Length'] = bodyBuffer.length;
    }

    const proxyReq = lib.request(opciones, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end',  () => resolve({
        statusCode: proxyRes.statusCode,
        headers:    proxyRes.headers,
        body:       Buffer.concat(chunks),
      }));
      proxyRes.on('error', reject);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      reject(new Error('Timeout: el proveedor no respondió en 30 segundos.'));
    });

    proxyReq.on('error', reject);

    if (bodyBuffer) proxyReq.write(bodyBuffer);
    proxyReq.end();
  });
}

async function _actualizarMetrica(logId, statusCode, latenciaMs, errorMessage) {
  if (!logId) return;
  try {
    await ApiUsageLog.updateOne({ id: logId }).set({
      status_code:      statusCode,
      response_time_ms: latenciaMs,
      error_message:    errorMessage || null,
    });
  } catch (err) {
    sails.log.error('Gateway: Error al actualizar ApiUsageLog:', err.message);
  }
}
