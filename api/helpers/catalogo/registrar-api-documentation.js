const flaverr = require("flaverr");
const { v4: uuidv4 } = require("uuid");

// ─── Funciones extraídas (CC ~5 cada una) ────────────────────────────────────

/**
 * Verifica que la API exista en la BD.
 * CC ~2
 */
async function resolverApi(apiId, db) {
  const api = await Api.findOne({ id: apiId }).usingConnection(db);
  if (!api) {
    throw flaverr(
      { code: "E_API_NOT_FOUND" },
      new Error(`API with id ${apiId} not found`)
    );
  }
  sails.log.verbose(`API encontrada: ${api.title}`);
  return api;
}

/**
 * Busca o crea la versión. Si ya existe y updateExisting=false, lanza error.
 * CC ~4
 */
async function resolverVersion(apiId, versionName, changelog, updateExisting, db) {
  let apiVersion = await ApiVersion.findOne({
    api_id: apiId,
    version_name: versionName,
  }).usingConnection(db);

  if (apiVersion && !updateExisting) {
    throw flaverr(
      { code: "E_VERSION_EXISTS" },
      new Error(
        `Version ${versionName} already exists. Set updateExisting=true to update it.`
      )
    );
  }

  if (!apiVersion) {
    apiVersion = await ApiVersion.create({
      id: uuidv4(),
      api_id: apiId,
      version_name: versionName,
      changelog: changelog || null,
      created_at: new Date(),
    })
      .fetch()
      .usingConnection(db);

    sails.log.verbose(`Nueva versión creada: ${versionName}`);
  } else {
    if (changelog) {
      await ApiVersion.updateOne({ id: apiVersion.id })
        .set({ changelog })
        .usingConnection(db);
    }
    sails.log.verbose(`Versión actualizada: ${versionName}`);
  }

  return apiVersion;
}

/**
 * Elimina todos los endpoints y sus relaciones para una versión dada.
 * CC ~3
 */
async function eliminarEndpointsAntiguos(apiVersionId, db) {
  const oldEndpoints = await ApiEndpoint.find({
    api_version_id: apiVersionId,
  }).usingConnection(db);

  for (const oldEndpoint of oldEndpoints) {
    await ApiParameter.destroy({ endpoint_id: oldEndpoint.id }).usingConnection(db);
    await ApiBody.destroy({ endpoint_id: oldEndpoint.id }).usingConnection(db);
    await ApiResponse.destroy({ endpoint_id: oldEndpoint.id }).usingConnection(db);
  }

  await ApiEndpoint.destroy({ api_version_id: apiVersionId }).usingConnection(db);
}

/**
 * Crea los parámetros (query, path, headers) de un endpoint.
 * CC ~4
 */
async function crearParametros(endpointId, endpointData, db) {
  const todosLosParams = [
    ...(Array.isArray(endpointData.parameters) ? endpointData.parameters : []),
    ...(Array.isArray(endpointData.headers) ? endpointData.headers : []),
  ];

  const parameters = [];
  for (const paramData of todosLosParams) {
    if (!paramData.name || !paramData.type) {
      sails.log.warn("Parámetro sin name o type, saltando:", paramData);
      continue;
    }
    const parameter = await ApiParameter.create({
      id: uuidv4(),
      endpoint_id: endpointId,
      name: paramData.name,
      type: paramData.type,
      required: paramData.required || false,
      description: paramData.description || null,
      location: paramData.location || "query",
      example: paramData.example || null,
    })
      .fetch()
      .usingConnection(db);

    parameters.push(parameter);
  }
  return parameters;
}

/**
 * Crea los bodies de un endpoint.
 * CC ~3
 */
async function crearBodies(endpointId, endpointData, db) {
  const bodies = [];
  if (!Array.isArray(endpointData.bodies)) return bodies;

  for (const bodyData of endpointData.bodies) {
    const body = await ApiBody.create({
      id: uuidv4(),
      endpoint_id: endpointId,
      content_type: bodyData.content_type || "application/json",
      example: bodyData.example || null,
    })
      .fetch()
      .usingConnection(db);

    bodies.push(body);
  }
  return bodies;
}

/**
 * Crea las responses de un endpoint.
 * CC ~4
 */
async function crearResponses(endpointId, endpointData, db) {
  const responses = [];
  if (!Array.isArray(endpointData.responses)) return responses;

  for (const responseData of endpointData.responses) {
    if (!responseData.status_code) {
      sails.log.warn("Response sin status_code, saltando:", responseData);
      continue;
    }
    const response = await ApiResponse.create({
      id: uuidv4(),
      endpoint_id: endpointId,
      status_code: responseData.status_code,
      content_type: responseData.content_type || "application/json",
      example: responseData.example || null,
    })
      .fetch()
      .usingConnection(db);

    responses.push(response);
  }
  return responses;
}

/**
 * Crea un endpoint completo con sus parámetros, bodies y responses.
 * CC ~5
 */
async function crearEndpointCompleto(apiVersionId, endpointData, db) {
  if (!endpointData.path || !endpointData.method) {
    sails.log.warn("Endpoint sin path o method, saltando:", endpointData);
    return null;
  }

  const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
  if (!validMethods.includes(endpointData.method.toUpperCase())) {
    sails.log.warn(`Método inválido: ${endpointData.method}, saltando endpoint`);
    return null;
  }

  const endpoint = await ApiEndpoint.create({
    id: uuidv4(),
    api_version_id: apiVersionId,
    path: endpointData.path,
    method: endpointData.method.toUpperCase(),
    description: endpointData.description || null,
    is_auth_endpoint: endpointData.is_auth_endpoint || false,
    auth_notes: endpointData.auth_notes || null,
    requires_token_from: endpointData.requires_token_from || null,
    created_at: new Date(),
  })
    .fetch()
    .usingConnection(db);

  sails.log.verbose(`Endpoint creado: ${endpoint.method} ${endpoint.path}`);

  const [parameters, bodies, responses] = await Promise.all([
    crearParametros(endpoint.id, endpointData, db),
    crearBodies(endpoint.id, endpointData, db),
    crearResponses(endpoint.id, endpointData, db),
  ]);

  return { endpoint, parameters, bodies, responses };
}

// ─── Helper principal ─────────────────────────────────────────────────────────

module.exports = {
  friendlyName: "Registrar API Documentation",

  description:
    "Helper to register or update complete API documentation including endpoints, parameters, bodies, and responses.",

  inputs: {
    apiId: {
      type: "string",
      required: true,
      description: "UUID of the API to document.",
    },
    versionName: {
      type: "string",
      required: true,
      description: "Version name (e.g., 'v1', '1.0.0')",
      example: "v1",
    },
    changelog: {
      type: "ref",
      description: "Version changelog/notes",
    },
    endpoints: {
      type: "json",
      required: true,
      description: "Array of endpoint objects with their documentation",
    },
    updateExisting: {
      type: "boolean",
      required: false,
      defaultsTo: false,
      description: "If true, updates existing version instead of creating new one",
    },
  },

  fn: async function ({ apiId, versionName, changelog, endpoints, updateExisting }) {
    // CC ~6 — orquesta las funciones extraídas, no contiene lógica propia
    sails.log.verbose("-----> Helper: Registrar API Documentation");

    try {
      let result = {
        version: null,
        endpoints: [],
        totalCreated: 0,
        totalUpdated: 0,
      };

      await Api.getDatastore().transaction(async (db) => {
        // 1. Verificar API
        await resolverApi(apiId, db);

        // 2. Resolver versión
        const apiVersion = await resolverVersion(
          apiId, versionName, changelog, updateExisting, db
        );
        result.version = apiVersion;

        // 3. Limpiar endpoints antiguos si se está actualizando
        if (updateExisting) {
          await eliminarEndpointsAntiguos(apiVersion.id, db);
        }

        // 4. Crear endpoints
        for (const endpointData of endpoints) {
          const endpointResult = await crearEndpointCompleto(
            apiVersion.id, endpointData, db
          );
          if (!endpointResult) continue;

          result.endpoints.push(endpointResult);
          updateExisting ? result.totalUpdated++ : result.totalCreated++;
        }

        // 5. Log de verificación final
        const finalEndpoints = await ApiEndpoint.find({
          api_version_id: apiVersion.id,
        }).usingConnection(db);

        sails.log.verbose(`=== Documentación registrada exitosamente ===`);
        sails.log.verbose(`Total endpoints procesados: ${result.endpoints.length}`);
        sails.log.verbose(`Creados: ${result.totalCreated} | Actualizados: ${result.totalUpdated}`);
        sails.log.verbose(`Endpoints finales en BD: ${finalEndpoints.length}`);
        finalEndpoints.forEach((ep, idx) => {
          sails.log.verbose(`  ${idx + 1}. ${ep.method} ${ep.path} (${ep.id})`);
        });
      });

      return {
        success: true,
        version: {
          id: result.version.id,
          version_name: result.version.version_name,
          changelog: result.version.changelog,
        },
        stats: {
          totalEndpoints: result.endpoints.length,
          totalCreated: result.totalCreated,
          totalUpdated: result.totalUpdated,
        },
        message: updateExisting
          ? `Documentation updated successfully for version ${versionName}`
          : `Documentation created successfully for version ${versionName}`,
      };
    } catch (error) {
      sails.log.error("Error en helper Registrar API Documentation:", error);

      if (error.code === "E_API_NOT_FOUND" || error.code === "E_VERSION_EXISTS") {
        throw error;
      }

      throw flaverr(
        {
          code: "E_REGISTRAR_API_DOCUMENTATION",
          message: "Error al registrar la documentación de la API",
        },
        error
      );
    }
  },
};
