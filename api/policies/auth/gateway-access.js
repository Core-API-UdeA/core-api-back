/**
 * api/policies/auth/gateway-access.js
 *
 * Policy dual para el gateway: acepta autenticación por JWT Bearer
 * O por API Key de suscripción (header X-Api-Key).
 *
 * Flujo:
 *   1. ¿Hay Authorization: Bearer <jwt>?
 *      → Valida el JWT (flujo original desde la app web)
 *
 *   2. ¿Hay X-Api-Key: sk_live_...?
 *      → Busca la suscripción activa en BD por api_key
 *      → Construye req.decoded con el user_id de esa suscripción
 *      (flujo externo: Postman, curl, integraciones)
 *
 *   3. Ninguno de los dos → 401
 *
 * En ambos casos el proxy recibe req.decoded.sub con el userId
 * y funciona exactamente igual que antes.
 */

module.exports = async function (req, res, proceed) {
  sails.log.debug('\n==============================\n');
  sails.log.debug('\tgateway-access policy (JWT | API Key)');
  sails.log.debug('\n==============================\n');

  // ─── Camino 1: JWT Bearer (desde la app web de CoreAPI) ────────────────
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          ejecucion: {
            respuesta: {
              estado: 'NOK',
              mensaje: 'Token JWT vacío.',
            },
          },
        });
      }

      const decoded = await sails.helpers.auth.verifyJwtToken.with({ token });

      if (!decoded) {
        return res.status(401).json({
          ejecucion: {
            respuesta: {
              estado: 'NOK',
              mensaje: 'Token JWT inválido o expirado.',
            },
          },
        });
      }

      req.decoded = decoded;
      req.authMethod = 'jwt';

      sails.log.verbose('Gateway: autenticado por JWT | userId:', decoded.sub);
      return proceed();

    } catch (error) {
      sails.log.error('Gateway: error validando JWT:', error.message);
      return res.status(401).json({
        ejecucion: {
          respuesta: {
            estado: 'NOK',
            mensaje: 'Token JWT inválido.',
          },
        },
      });
    }
  }

  // ─── Camino 2: API Key (desde Postman, curl, integraciones externas) ───
  // Aceptamos el header en cualquiera de sus variantes comunes
  const apiKey = req.headers['x-api-key']
               || req.headers['X-Api-Key']
               || req.headers['x-apikey']
               || req.query['api_key'];   // también por query param como fallback

  if (apiKey) {
    try {
      // Buscar la suscripción activa con esa key
      const subscription = await ApiSubscription.findOne({
        api_key: apiKey,
        status:  'active',
      }).populate('plan_id');

      if (!subscription) {
        sails.log.warn('Gateway: API Key no encontrada o suscripción inactiva | key:', apiKey.slice(0, 12) + '...');
        return res.status(401).json({
          ejecucion: {
            respuesta: {
              estado: 'NOK',
              mensaje: 'API Key inválida o suscripción inactiva. Revisa tu key en CoreAPI.',
            },
          },
        });
      }

      // Construir req.decoded con el mismo formato que genera el JWT
      // para que el proxy funcione sin cambios
      req.decoded = {
        sub:  subscription.user_id,
        iss:  'core-api-api-key',
        user: {
          id:    subscription.user_id,
          email: null, // no disponible sin JOIN, no es necesario para el proxy
        },
        rol:  'usuario',
        // Adjuntamos la suscripción para que el proxy pueda skipear
        // la búsqueda de suscripción (optimización opcional)
        _subscription: subscription,
      };

      req.authMethod    = 'api_key';
      req.apiKeySlug    = subscription.api_id; // UUID de la API para validar que coincide con el slug

      sails.log.verbose(
        'Gateway: autenticado por API Key | userId:',
        subscription.user_id,
        '| subscriptionId:',
        subscription.id
      );

      return proceed();

    } catch (error) {
      sails.log.error('Gateway: error validando API Key:', error.message);
      return res.status(500).json({
        ejecucion: {
          respuesta: {
            estado: 'NOK',
            mensaje: 'Error interno al validar la API Key.',
          },
        },
      });
    }
  }

  // ─── Camino 3: Sin credenciales ────────────────────────────────────────
  sails.log.warn('Gateway: solicitud sin credenciales (sin JWT ni API Key)');
  return res.status(401).json({
    ejecucion: {
      respuesta: {
        estado: 'NOK',
        mensaje: 'Se requiere autenticación. Incluye tu JWT (Authorization: Bearer <token>) o tu API Key (X-Api-Key: <key>).',
      },
    },
  });
};
