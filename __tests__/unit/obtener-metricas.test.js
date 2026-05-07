'use strict';

/**
 * __tests__/unit/obtener-metricas-helper.test.js
 *
 * Tests del helper api/helpers/gateway/obtener-metricas.js
 *
 * IMPORTANTE: Para los tests de funciones privadas (HOM-PRIV-*),
 * en obtener-metricas.js se debe agregar al final:
 *
 *   module.exports._private = {
 *     _agruparPorDia,
 *     _latenciaPorDia,
 *     _consumoPorRegion,
 *     _tendencia,
 *   };
 *
 * Si prefieres no exportarlas, comenta el describe "Funciones privadas"
 * y la cobertura igualmente subirá vía los tests del fn principal.
 */

global.sails = {
  log: {
    verbose: jest.fn(),
    error: jest.fn(),
  },
};

// Mocks de modelos globales
global.Api = {
  findOne: jest.fn(),
};

global.ApiUsageLog = {
  getDatastore: jest.fn(),
};

const helper = require('../../api/helpers/gateway/obtener-metricas');

// ─── Helpers de tests ─────────────────────────────────────────────────────────

/**
 * Construye un log de uso con valores razonables por defecto.
 * Permite override de cualquier campo.
 */
function buildLog(overrides = {}) {
  return {
    id: 'log-' + Math.random().toString(36).slice(2, 8),
    user_id: 'user-1',
    endpoint_path: '/forecast',
    method: 'GET',
    status_code: 200,
    response_time_ms: 150,
    ip_address: '192.168.1.10',
    timestamp: new Date('2026-05-05T10:00:00Z'),
    ...overrides,
  };
}

/**
 * Configura sendNativeQuery con dos respuestas:
 *   1ª llamada → logs del período actual
 *   2ª llamada → logs del período anterior
 */
function setupDatastore(logsActuales = [], logsAnteriores = []) {
  const sendNativeQuery = jest.fn()
    .mockResolvedValueOnce({ rows: logsActuales })
    .mockResolvedValueOnce({ rows: logsAnteriores });

  ApiUsageLog.getDatastore.mockReturnValue({
    sendNativeQuery,
  });

  return sendNativeQuery;
}

/**
 * Inputs por defecto del helper.
 */
function defaultInputs(overrides = {}) {
  return {
    apiId: 'api-1',
    ownerId: 'owner-1',
    diasAtras: 7,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests del fn principal ───────────────────────────────────────────────────

describe('obtenerMetricas — Validación de ownership', () => {

  test('HOM-01 | API no existe o no pertenece al owner → lanza E_API_NO_ENCONTRADA', async () => {
    Api.findOne.mockResolvedValue(null);

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toMatchObject({ code: 'E_API_NO_ENCONTRADA' });

    expect(Api.findOne).toHaveBeenCalledWith({
      id: 'api-1',
      owner_id: 'owner-1',
    });
  });

  test('HOM-02 | E_API_NO_ENCONTRADA NO se envuelve en E_OBTENER_METRICAS', async () => {
    Api.findOne.mockResolvedValue(null);

    try {
      await helper.fn(defaultInputs());
      fail('debería haber lanzado');
    } catch (error) {
      expect(error.code).toBe('E_API_NO_ENCONTRADA');
      expect(error.code).not.toBe('E_OBTENER_METRICAS');
    }
  });

});

describe('obtenerMetricas — Sin datos en el período', () => {

  beforeEach(() => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });
  });

  test('HOM-03 | Sin logs → KPIs en cero', async () => {
    setupDatastore([], []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.totalConsumo).toBe(0);
    expect(result.kpis.errores).toBe(0);
    expect(result.kpis.exitosos).toBe(0);
    expect(result.kpis.tasaError).toBe(0);
    expect(result.kpis.usuariosUnicos).toBe(0);
    expect(result.kpis.tiempoPromedio).toBe(0);
  });

  test('HOM-04 | Sin logs → series temporales con días rellenados en 0', async () => {
    setupDatastore([], []);

    const result = await helper.fn(defaultInputs({ diasAtras: 7 }));

    expect(result.graficos.requestsPorDia).toHaveLength(7);
    expect(result.graficos.latenciaPorDia).toHaveLength(7);
    expect(result.graficos.requestsPorDia.every(d => d.total === 0)).toBe(true);
    expect(result.graficos.latenciaPorDia.every(d => d.latenciaPromedio === 0)).toBe(true);
  });

  test('HOM-05 | Sin logs → endpoints, consumo y regiones vacíos', async () => {
    setupDatastore([], []);

    const result = await helper.fn(defaultInputs());

    expect(result.endpointsMasUsados).toEqual([]);
    expect(result.consumoPorEndpoint).toEqual([]);
    expect(result.consumoPorRegion).toEqual([]);
  });

});

describe('obtenerMetricas — KPIs con datos', () => {

  beforeEach(() => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });
  });

  test('HOM-06 | totalConsumo refleja la cantidad de logs', async () => {
    const logs = [
      buildLog({ status_code: 200 }),
      buildLog({ status_code: 200 }),
      buildLog({ status_code: 200 }),
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.totalConsumo).toBe(3);
  });

  test('HOM-07 | Cuenta errores con status_code >= 400', async () => {
    const logs = [
      buildLog({ status_code: 200 }),
      buildLog({ status_code: 404 }),
      buildLog({ status_code: 500 }),
      buildLog({ status_code: 399 }), // sigue siendo exitoso
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.errores).toBe(2);
    expect(result.kpis.exitosos).toBe(2);
  });

  test('HOM-08 | tasaError calcula porcentaje con 1 decimal', async () => {
    const logs = [
      buildLog({ status_code: 200 }),
      buildLog({ status_code: 200 }),
      buildLog({ status_code: 500 }), // 1/3 = 33.3%
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.tasaError).toBe(33.3);
  });

  test('HOM-09 | usuariosUnicos cuenta user_id distintos', async () => {
    const logs = [
      buildLog({ user_id: 'user-A' }),
      buildLog({ user_id: 'user-A' }),
      buildLog({ user_id: 'user-B' }),
      buildLog({ user_id: 'user-C' }),
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.usuariosUnicos).toBe(3);
  });

  test('HOM-10 | tiempoPromedio es el promedio entero de response_time_ms', async () => {
    const logs = [
      buildLog({ response_time_ms: 100 }),
      buildLog({ response_time_ms: 200 }),
      buildLog({ response_time_ms: 300 }),
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.tiempoPromedio).toBe(200);
  });

  test('HOM-11 | tiempoPromedio acepta response_time_ms como string', async () => {
    // sendNativeQuery a veces devuelve numéricos como strings
    const logs = [
      buildLog({ response_time_ms: '100' }),
      buildLog({ response_time_ms: '300' }),
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.tiempoPromedio).toBe(200);
  });

});

describe('obtenerMetricas — Endpoints más usados', () => {

  beforeEach(() => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });
  });

  test('HOM-12 | Agrupa por method + endpoint_path', async () => {
    const logs = [
      buildLog({ method: 'GET', endpoint_path: '/forecast' }),
      buildLog({ method: 'GET', endpoint_path: '/forecast' }),
      buildLog({ method: 'POST', endpoint_path: '/forecast' }), // distinto
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.endpointsMasUsados).toEqual([
      { method: 'GET',  path: '/forecast', total: 2 },
      { method: 'POST', path: '/forecast', total: 1 },
    ]);
  });

  test('HOM-13 | Top 5 — con 6 endpoints distintos solo retorna 5', async () => {
    const logs = [];
    for (let i = 0; i < 6; i++) {
      // cada endpoint tiene (i+1) llamadas para forzar orden
      for (let j = 0; j <= i; j++) {
        logs.push(buildLog({ endpoint_path: `/ep-${i}` }));
      }
    }
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.endpointsMasUsados).toHaveLength(5);
    expect(result.endpointsMasUsados[0].total).toBeGreaterThan(
      result.endpointsMasUsados[4].total
    );
  });

  test('HOM-14 | consumoPorEndpoint incluye porcentaje correcto', async () => {
    const logs = [
      buildLog({ endpoint_path: '/a' }),
      buildLog({ endpoint_path: '/a' }),
      buildLog({ endpoint_path: '/a' }),
      buildLog({ endpoint_path: '/b' }), // 3 vs 1 → 75% / 25%
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    const epA = result.consumoPorEndpoint.find(e => e.endpoint === 'GET /a');
    const epB = result.consumoPorEndpoint.find(e => e.endpoint === 'GET /b');

    expect(epA.porcentaje).toBe(75);
    expect(epB.porcentaje).toBe(25);
  });

});

describe('obtenerMetricas — Consumo por región', () => {

  beforeEach(() => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });
  });

  test('HOM-15 | Agrupa IPv4 por primeros 2 octetos', async () => {
    const logs = [
      buildLog({ ip_address: '192.168.1.10' }),
      buildLog({ ip_address: '192.168.5.20' }), // mismo prefijo 192.168
      buildLog({ ip_address: '10.0.0.1' }),
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    const region192 = result.consumoPorRegion.find(r => r.region === '192.168');
    const region10  = result.consumoPorRegion.find(r => r.region === '10.0');

    expect(region192.total).toBe(2);
    expect(region10.total).toBe(1);
  });

  test('HOM-16 | IPv6 (::) se agrupa como "Local"', async () => {
    const logs = [
      buildLog({ ip_address: '::1' }),
      buildLog({ ip_address: '::ffff:127.0.0.1' }),
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    const local = result.consumoPorRegion.find(r => r.region === 'Local');
    expect(local.total).toBe(2);
  });

  test('HOM-17 | Logs sin ip_address se ignoran', async () => {
    const logs = [
      buildLog({ ip_address: null }),
      buildLog({ ip_address: '192.168.1.1' }),
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.consumoPorRegion).toHaveLength(1);
    expect(result.consumoPorRegion[0].region).toBe('192.168');
  });

  test('HOM-18 | Top 5 regiones máximo', async () => {
    const logs = [];
    for (let i = 0; i < 7; i++) {
      logs.push(buildLog({ ip_address: `10.${i}.0.1` }));
    }
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs());

    expect(result.consumoPorRegion).toHaveLength(5);
  });

});

describe('obtenerMetricas — Series temporales', () => {

  beforeEach(() => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });
  });

  test('HOM-19 | requestsPorDia tiene tantos elementos como diasAtras', async () => {
    setupDatastore([], []);

    const r7  = await helper.fn(defaultInputs({ diasAtras: 7 }));
    expect(r7.graficos.requestsPorDia).toHaveLength(7);
  });

  test('HOM-20 | latenciaPorDia rellena días sin datos con 0', async () => {
    // Solo un log de hoy
    const logs = [
      buildLog({
        timestamp: new Date(),
        response_time_ms: 500,
      }),
    ];
    setupDatastore(logs, []);

    const result = await helper.fn(defaultInputs({ diasAtras: 7 }));

    const conLatencia = result.graficos.latenciaPorDia.filter(d => d.latenciaPromedio > 0);
    const enCero      = result.graficos.latenciaPorDia.filter(d => d.latenciaPromedio === 0);

    expect(conLatencia.length).toBeLessThanOrEqual(1);
    expect(enCero.length).toBeGreaterThanOrEqual(6);
  });

});

describe('obtenerMetricas — Tendencias vs período anterior', () => {

  beforeEach(() => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });
  });

  test('HOM-21 | Tendencia positiva: actual > anterior', async () => {
    const actuales   = [buildLog(), buildLog(), buildLog()]; // 3
    const anteriores = [{ status_code: 200, response_time_ms: 100, user_id: 'u1' }]; // 1
    setupDatastore(actuales, anteriores);

    const result = await helper.fn(defaultInputs());

    // (3 - 1) / 1 * 100 = 200
    expect(result.kpis.tendencias.consumo).toBe(200);
  });

  test('HOM-22 | Tendencia negativa: actual < anterior', async () => {
    const actuales = [buildLog()]; // 1
    const anteriores = [
      { status_code: 200, response_time_ms: 100, user_id: 'u1' },
      { status_code: 200, response_time_ms: 100, user_id: 'u2' },
      { status_code: 200, response_time_ms: 100, user_id: 'u3' },
      { status_code: 200, response_time_ms: 100, user_id: 'u4' },
    ]; // 4

    setupDatastore(actuales, anteriores);

    const result = await helper.fn(defaultInputs());

    // (1 - 4) / 4 * 100 = -75
    expect(result.kpis.tendencias.consumo).toBe(-75);
  });

  test('HOM-23 | Anterior=0 y actual>0 → tendencia 100', async () => {
    setupDatastore([buildLog()], []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.tendencias.consumo).toBe(100);
  });

  test('HOM-24 | Anterior=0 y actual=0 → tendencia 0', async () => {
    setupDatastore([], []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.tendencias.consumo).toBe(0);
    expect(result.kpis.tendencias.usuarios).toBe(0);
    expect(result.kpis.tendencias.errores).toBe(0);
    expect(result.kpis.tendencias.tiempoPromedio).toBe(0);
  });

  test('HOM-25 | Tendencias se calculan para los 4 KPIs', async () => {
    setupDatastore([buildLog()], []);

    const result = await helper.fn(defaultInputs());

    expect(result.kpis.tendencias).toEqual(
      expect.objectContaining({
        consumo:        expect.any(Number),
        usuarios:       expect.any(Number),
        errores:        expect.any(Number),
        tiempoPromedio: expect.any(Number),
      })
    );
  });

});

describe('obtenerMetricas — Estructura del retorno', () => {

  beforeEach(() => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });
  });

  test('HOM-26 | Retorna las claves principales esperadas', async () => {
    setupDatastore([], []);

    const result = await helper.fn(defaultInputs());

    expect(result).toEqual(
      expect.objectContaining({
        periodo:            expect.any(Object),
        kpis:               expect.any(Object),
        graficos:           expect.any(Object),
        endpointsMasUsados: expect.any(Array),
        consumoPorEndpoint: expect.any(Array),
        consumoPorRegion:   expect.any(Array),
      })
    );
  });

  test('HOM-27 | periodo incluye diasAtras, desde y hasta', async () => {
    setupDatastore([], []);

    const result = await helper.fn(defaultInputs({ diasAtras: 30 }));

    expect(result.periodo.diasAtras).toBe(30);
    expect(typeof result.periodo.desde).toBe('string');
    expect(typeof result.periodo.hasta).toBe('string');
  });

});

describe('obtenerMetricas — Consultas SQL', () => {

  beforeEach(() => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });
  });

  test('HOM-28 | Llama sendNativeQuery 2 veces (período actual + anterior)', async () => {
    const sendNativeQuery = setupDatastore([], []);

    await helper.fn(defaultInputs());

    expect(sendNativeQuery).toHaveBeenCalledTimes(2);
  });

  test('HOM-29 | Primera consulta usa apiId y fechaInicio del período', async () => {
    const sendNativeQuery = setupDatastore([], []);

    await helper.fn(defaultInputs());

    const [, params] = sendNativeQuery.mock.calls[0];
    expect(params[0]).toBe('api-1');
    expect(typeof params[1]).toBe('string'); // ISO date
  });

  test('HOM-30 | Segunda consulta usa rango (anterior, actual)', async () => {
    const sendNativeQuery = setupDatastore([], []);

    await helper.fn(defaultInputs());

    const [, params] = sendNativeQuery.mock.calls[1];
    expect(params).toHaveLength(3);
    // params[1] = inicio anterior, params[2] = inicio actual (hasta)
    expect(new Date(params[1]) < new Date(params[2])).toBe(true);
  });

});

describe('obtenerMetricas — Manejo de errores', () => {

  test('HOM-31 | Falla la consulta SQL → lanza E_OBTENER_METRICAS', async () => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });

    ApiUsageLog.getDatastore.mockReturnValue({
      sendNativeQuery: jest.fn().mockRejectedValue(new Error('DB down')),
    });

    await expect(
      helper.fn(defaultInputs())
    ).rejects.toMatchObject({ code: 'E_OBTENER_METRICAS' });
  });

  test('HOM-32 | En cualquier error registra sails.log.error', async () => {
    Api.findOne.mockResolvedValue({ id: 'api-1', owner_id: 'owner-1' });

    ApiUsageLog.getDatastore.mockReturnValue({
      sendNativeQuery: jest.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(helper.fn(defaultInputs())).rejects.toThrow();
    expect(sails.log.error).toHaveBeenCalled();
  });

});

// ─── Tests directos de funciones privadas ─────────────────────────────────────
// Solo se ejecutan si _private fue exportado en el helper.

describe('obtenerMetricas — Funciones privadas (requiere export _private)', () => {

  // Skip todos los tests del bloque si no se exportó _private
  const _private = helper._private;
  const describeIfExported = _private ? describe : describe.skip;

  describeIfExported('_tendencia', () => {

    test('HOM-PRIV-01 | actual=0, anterior=0 → 0', () => {
      expect(_private._tendencia(0, 0)).toBe(0);
    });

    test('HOM-PRIV-02 | actual=10, anterior=0 → 100', () => {
      expect(_private._tendencia(10, 0)).toBe(100);
    });

    test('HOM-PRIV-03 | actual=20, anterior=10 → 100', () => {
      expect(_private._tendencia(20, 10)).toBe(100);
    });

    test('HOM-PRIV-04 | actual=5, anterior=10 → -50', () => {
      expect(_private._tendencia(5, 10)).toBe(-50);
    });

    test('HOM-PRIV-05 | redondea a 1 decimal', () => {
      // 1/3 → 33.333...
      expect(_private._tendencia(4, 3)).toBe(33.3);
    });

  });

  describeIfExported('_consumoPorRegion', () => {

    test('HOM-PRIV-06 | Array vacío → array vacío', () => {
      expect(_private._consumoPorRegion([])).toEqual([]);
    });

    test('HOM-PRIV-07 | Ignora logs sin ip_address', () => {
      const logs = [
        { ip_address: null },
        { ip_address: undefined },
        { ip_address: '10.0.0.1' },
      ];
      const result = _private._consumoPorRegion(logs);
      expect(result).toHaveLength(1);
    });

    test('HOM-PRIV-08 | Ordenamiento descendente por total', () => {
      const logs = [
        { ip_address: '1.1.0.0' },
        { ip_address: '2.2.0.0' },
        { ip_address: '2.2.0.0' },
        { ip_address: '2.2.0.0' },
      ];
      const result = _private._consumoPorRegion(logs);
      expect(result[0].region).toBe('2.2');
      expect(result[0].total).toBe(3);
    });

  });

  describeIfExported('_agruparPorDia', () => {

    test('HOM-PRIV-09 | Rellena días sin datos con total=0', () => {
      const fechaInicio = new Date('2026-05-01T00:00:00Z');
      const result = _private._agruparPorDia([], 3, fechaInicio);

      expect(result).toHaveLength(3);
      expect(result.every(d => d.total === 0)).toBe(true);
    });

    test('HOM-PRIV-10 | Cuenta logs en el día correcto', () => {
      const fechaInicio = new Date('2026-05-01T00:00:00Z');
      const logs = [
        { timestamp: new Date('2026-05-02T10:00:00Z') },
        { timestamp: new Date('2026-05-02T15:00:00Z') },
        { timestamp: new Date('2026-05-03T10:00:00Z') },
      ];

      const result = _private._agruparPorDia(logs, 3, fechaInicio);

      const dia2 = result.find(d => d.fecha === '2026-05-02');
      const dia3 = result.find(d => d.fecha === '2026-05-03');

      expect(dia2.total).toBe(2);
      expect(dia3.total).toBe(1);
    });

  });

  describeIfExported('_latenciaPorDia', () => {

    test('HOM-PRIV-11 | Promedia response_time_ms del día', () => {
      const fechaInicio = new Date('2026-05-01T00:00:00Z');
      const logs = [
        { timestamp: new Date('2026-05-02T10:00:00Z'), response_time_ms: 100 },
        { timestamp: new Date('2026-05-02T15:00:00Z'), response_time_ms: 300 },
      ];

      const result = _private._latenciaPorDia(logs, 3, fechaInicio);
      const dia2 = result.find(d => d.fecha === '2026-05-02');

      expect(dia2.latenciaPromedio).toBe(200);
    });

    test('HOM-PRIV-12 | Días sin datos → latenciaPromedio=0', () => {
      const fechaInicio = new Date('2026-05-01T00:00:00Z');
      const result = _private._latenciaPorDia([], 5, fechaInicio);

      expect(result).toHaveLength(5);
      expect(result.every(d => d.latenciaPromedio === 0)).toBe(true);
    });

  });

});
