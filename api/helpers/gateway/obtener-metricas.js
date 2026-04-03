/**
 * api/helpers/gateway/obtener-metricas.js
 *
 * Calcula y retorna las métricas de uso de una API para el panel del proveedor.
 * Trabaja directamente sobre api_usage_logs para el período solicitado.
 *
 * Retorna los mismos bloques que muestra el panel de la imagen:
 *   - KPIs: total consumo, usuarios consultando, errores, tiempo promedio
 *   - Serie temporal de requests (para el gráfico de línea)
 *   - Endpoints más usados
 *   - Consumo por endpoint (para el donut)
 *   - Latencia por día (para el gráfico inferior)
 *   - Consumo por región (ip_address → agrupado)
 */

module.exports = {
  friendlyName: 'Obtener métricas de API',

  description:
    'Calcula las métricas de uso de una API para un período dado, ' +
    'a partir de los registros en api_usage_logs.',

  inputs: {
    apiId: {
      type: 'string',
      required: true,
      description: 'UUID de la API.',
    },
    ownerId: {
      type: 'string',
      required: true,
      description: 'UUID del owner — para verificar que la API le pertenece.',
    },
    diasAtras: {
      type: 'number',
      required: false,
      defaultsTo: 7,
      description: 'Número de días hacia atrás para el período. Ej: 7, 30.',
    },
  },

  fn: async function ({ apiId, ownerId, diasAtras }) {
    sails.log.verbose('-----> Helper: Obtener métricas | apiId:', apiId, '| días:', diasAtras);
    const flaverr = require('flaverr');

    try {
      // ─── Verificar ownership ────────────────────────────────────────────
      const api = await Api.findOne({ id: apiId, owner_id: ownerId });

      if (!api) {
        throw flaverr(
          { code: 'E_API_NO_ENCONTRADA' },
          new Error('La API no existe o no tienes permiso para verla.')
        );
      }

      // ─── Rango de fechas del período ────────────────────────────────────
      const ahora      = new Date();
      const fechaInicio = new Date(ahora);
      fechaInicio.setDate(fechaInicio.getDate() - diasAtras);
      fechaInicio.setHours(0, 0, 0, 0);

      // ─── Obtener todos los logs del período ─────────────────────────────
      // Sails waterline no soporta >= en timestamps con find() de forma portable,
      // usamos getDatastore().sendNativeQuery para la consulta principal
      const db = ApiUsageLog.getDatastore();

      const logsResult = await db.sendNativeQuery(
        `SELECT
          id,
          user_id,
          endpoint_path,
          method,
          status_code,
          response_time_ms,
          ip_address,
          timestamp
        FROM api_usage_logs
        WHERE api_id = $1
          AND timestamp >= $2
        ORDER BY timestamp ASC`,
        [apiId, fechaInicio.toISOString()]
      );

      const logs = logsResult.rows;

      // ─── KPIs globales ──────────────────────────────────────────────────
      const totalConsumo     = logs.length;
      const errores          = logs.filter(l => l.status_code >= 400).length;
      const exitosos         = totalConsumo - errores;
      const tasaError        = totalConsumo > 0
        ? parseFloat(((errores / totalConsumo) * 100).toFixed(1))
        : 0;

      const usuariosUnicos   = new Set(logs.map(l => l.user_id)).size;

      const tiempoPromedio   = totalConsumo > 0
        ? Math.round(logs.reduce((acc, l) => acc + Number(l.response_time_ms), 0) / totalConsumo)
        : 0;

      // ─── Serie temporal (requests por día) ──────────────────────────────
      const requestsPorDia = _agruparPorDia(logs, diasAtras, fechaInicio);

      // ─── Endpoints más usados ───────────────────────────────────────────
      const conteoEndpoints = {};
      logs.forEach(l => {
        const clave = `${l.method} ${l.endpoint_path}`;
        conteoEndpoints[clave] = (conteoEndpoints[clave] || 0) + 1;
      });

      const endpointsMasUsados = Object.entries(conteoEndpoints)
        .map(([clave, total]) => {
          const [method, ...rutaParts] = clave.split(' ');
          return { method, path: rutaParts.join(' '), total };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // ─── Consumo por endpoint (para el donut) ───────────────────────────
      const consumoPorEndpoint = endpointsMasUsados.map(ep => ({
        endpoint: `${ep.method} ${ep.path}`,
        total: ep.total,
        porcentaje: totalConsumo > 0
          ? parseFloat(((ep.total / totalConsumo) * 100).toFixed(1))
          : 0,
      }));

      // ─── Latencia promedio por día ───────────────────────────────────────
      const latenciaPorDia = _latenciaPorDia(logs, diasAtras, fechaInicio);

      // ─── Consumo por región (basado en el primer octeto de ip_address) ──
      // Agrupamos por país usando el prefijo de IP como aproximación,
      // ya que no tenemos geolocalización. Se expone tal cual para el panel.
      const consumoPorRegion = _consumoPorRegion(logs);

      // ─── Período anterior para calcular tendencias (%) ──────────────────
      const fechaInicioAnterior = new Date(fechaInicio);
      fechaInicioAnterior.setDate(fechaInicioAnterior.getDate() - diasAtras);

      const logsAnterioresResult = await db.sendNativeQuery(
        `SELECT status_code, response_time_ms, user_id
        FROM api_usage_logs
        WHERE api_id = $1
          AND timestamp >= $2
          AND timestamp < $3`,
        [apiId, fechaInicioAnterior.toISOString(), fechaInicio.toISOString()]
      );

      const logsAnteriores     = logsAnterioresResult.rows;
      const totalAnterior      = logsAnteriores.length;
      const erroresAnteriores  = logsAnteriores.filter(l => l.status_code >= 400).length;
      const usuariosAnteriores = new Set(logsAnteriores.map(l => l.user_id)).size;
      const tiempoAnterior     = totalAnterior > 0
        ? Math.round(logsAnteriores.reduce((acc, l) => acc + Number(l.response_time_ms), 0) / totalAnterior)
        : 0;

      const tendencias = {
        consumo:        _tendencia(totalConsumo, totalAnterior),
        usuarios:       _tendencia(usuariosUnicos, usuariosAnteriores),
        errores:        _tendencia(errores, erroresAnteriores),
        tiempoPromedio: _tendencia(tiempoPromedio, tiempoAnterior),
      };

      return {
        periodo: {
          diasAtras,
          desde: fechaInicio.toISOString(),
          hasta: ahora.toISOString(),
        },
        kpis: {
          totalConsumo,
          usuariosUnicos,
          errores,
          tasaError,
          exitosos,
          tiempoPromedio,
          tendencias,
        },
        graficos: {
          requestsPorDia,
          latenciaPorDia,
        },
        endpointsMasUsados,
        consumoPorEndpoint,
        consumoPorRegion,
      };

    } catch (error) {
      sails.log.error('Error en helper obtener-metricas:', error);

      if (error.code === 'E_API_NO_ENCONTRADA') {
        throw error;
      }

      throw flaverr(
        { code: 'E_OBTENER_METRICAS', message: 'Error al calcular métricas' },
        error
      );
    }
  },
};

// ─── Funciones privadas ───────────────────────────────────────────────────────

/**
 * Agrupa los logs por día y rellena los días sin datos con 0.
 * Retorna array de { fecha, total } ordenado ascendente.
 */
function _agruparPorDia(logs, diasAtras, fechaInicio) {
  const conteo = {};

  logs.forEach(l => {
    const dia = new Date(l.timestamp).toISOString().slice(0, 10);
    conteo[dia] = (conteo[dia] || 0) + 1;
  });

  const serie = [];
  for (let i = 0; i < diasAtras; i++) {
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + i);
    const clave = fecha.toISOString().slice(0, 10);
    serie.push({ fecha: clave, total: conteo[clave] || 0 });
  }

  return serie;
}

/**
 * Latencia promedio por día, rellenando días sin datos con 0.
 */
function _latenciaPorDia(logs, diasAtras, fechaInicio) {
  const acumulado = {};

  logs.forEach(l => {
    const dia = new Date(l.timestamp).toISOString().slice(0, 10);
    if (!acumulado[dia]) acumulado[dia] = { suma: 0, count: 0 };
    acumulado[dia].suma  += Number(l.response_time_ms);
    acumulado[dia].count += 1;
  });

  const serie = [];
  for (let i = 0; i < diasAtras; i++) {
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + i);
    const clave = fecha.toISOString().slice(0, 10);
    const datos = acumulado[clave];
    serie.push({
      fecha: clave,
      latenciaPromedio: datos ? Math.round(datos.suma / datos.count) : 0,
    });
  }

  return serie;
}

/**
 * Agrupa consumo por los primeros 2 octetos de la IP (aproximación de región).
 * Retorna los top 5 ordenados por total DESC.
 */
function _consumoPorRegion(logs) {
  const conteo = {};

  logs.forEach(l => {
    if (!l.ip_address) return;
    // Usamos la IP completa — en producción se puede integrar una librería de geo-IP
    const region = l.ip_address.startsWith('::') ? 'Local' : l.ip_address.split('.').slice(0, 2).join('.');
    conteo[region] = (conteo[region] || 0) + 1;
  });

  return Object.entries(conteo)
    .map(([region, total]) => ({ region, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

/**
 * Calcula la tendencia porcentual entre el período actual y el anterior.
 * Retorna el porcentaje con signo: +12.8 o -3.2
 */
function _tendencia(actual, anterior) {
  if (anterior === 0) return actual > 0 ? 100 : 0;
  return parseFloat((((actual - anterior) / anterior) * 100).toFixed(1));
}
