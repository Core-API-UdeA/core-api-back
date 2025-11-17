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
      type: "string",
      required: false,
      description: "Version changelog/notes",
    },
    endpoints: {
      type: "json",
      required: true,
      description: "Array of endpoint objects with their documentation",
      example: [
        {
          path: "/users",
          method: "GET",
          description: "Get all users",
          parameters: [
            {
              name: "page",
              type: "integer",
              required: false,
              description: "Page number for pagination",
            },
            {
              name: "limit",
              type: "integer",
              required: false,
              description: "Number of items per page",
            },
          ],
          bodies: [],
          responses: [
            {
              status_code: 200,
              content_type: "application/json",
              example: { users: [], total: 0 },
            },
          ],
        },
        {
          path: "/users",
          method: "POST",
          description: "Create a new user",
          parameters: [],
          bodies: [
            {
              content_type: "application/json",
              example: { name: "John Doe", email: "john@example.com" },
            },
          ],
          responses: [
            {
              status_code: 201,
              content_type: "application/json",
              example: { id: 1, name: "John Doe", email: "john@example.com" },
            },
          ],
        },
      ],
    },
    updateExisting: {
      type: "boolean",
      required: false,
      defaultsTo: false,
      description:
        "If true, updates existing version instead of creating new one",
    },
  },

  fn: async function ({
    apiId,
    versionName,
    changelog,
    endpoints,
    updateExisting,
  }) {
    sails.log.verbose("-----> Helper: Registrar API Documentation");
    const flaverr = require("flaverr");
    const { v4: uuidv4 } = require("uuid");

    try {
      let result = {
        version: null,
        endpoints: [],
        totalCreated: 0,
        totalUpdated: 0,
      };

      await Api.getDatastore().transaction(async (db) => {
        // 1. Verificar que la API exista
        const api = await Api.findOne({ id: apiId }).usingConnection(db);
        if (!api) {
          throw flaverr(
            { code: "E_API_NOT_FOUND" },
            new Error(`API with id ${apiId} not found`)
          );
        }

        sails.log.verbose(`API encontrada: ${api.title}`);

        // 2. Buscar o crear la versión
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
          // Crear nueva versión
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
          // Actualizar versión existente
          if (changelog) {
            await ApiVersion.updateOne({ id: apiVersion.id })
              .set({ changelog })
              .usingConnection(db);
          }

          // Si se actualiza, eliminar endpoints antiguos
          const oldEndpoints = await ApiEndpoint.find({
            api_version_id: apiVersion.id,
          }).usingConnection(db);

          for (const oldEndpoint of oldEndpoints) {
            // Eliminar parámetros, bodies y responses asociados
            await ApiParameter.destroy({
              endpoint_id: oldEndpoint.id,
            }).usingConnection(db);
            await ApiBody.destroy({
              endpoint_id: oldEndpoint.id,
            }).usingConnection(db);
            await ApiResponse.destroy({
              endpoint_id: oldEndpoint.id,
            }).usingConnection(db);
          }

          // Eliminar los endpoints
          await ApiEndpoint.destroy({
            api_version_id: apiVersion.id,
          }).usingConnection(db);

          sails.log.verbose(`Versión actualizada: ${versionName}`);
        }

        result.version = apiVersion;

        // 3. Crear los endpoints y sus relaciones
        for (const endpointData of endpoints) {
          // Validar datos requeridos del endpoint
          if (!endpointData.path || !endpointData.method) {
            sails.log.warn(
              "Endpoint sin path o method, saltando:",
              endpointData
            );
            continue;
          }

          // Validar método HTTP
          const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
          if (!validMethods.includes(endpointData.method.toUpperCase())) {
            sails.log.warn(
              `Método inválido: ${endpointData.method}, saltando endpoint`
            );
            continue;
          }

          // Crear el endpoint
          const endpoint = await ApiEndpoint.create({
            id: uuidv4(),
            api_version_id: apiVersion.id,
            path: endpointData.path,
            method: endpointData.method.toUpperCase(),
            description: endpointData.description || null,
            created_at: new Date(),
          })
            .fetch()
            .usingConnection(db);

          sails.log.verbose(
            `Endpoint creado: ${endpoint.method} ${endpoint.path}`
          );

          // Crear parámetros
          const parameters = [];
          if (
            endpointData.parameters &&
            Array.isArray(endpointData.parameters)
          ) {
            for (const paramData of endpointData.parameters) {
              if (!paramData.name || !paramData.type) {
                sails.log.warn(
                  "Parámetro sin name o type, saltando:",
                  paramData
                );
                continue;
              }

              const parameter = await ApiParameter.create({
                id: uuidv4(),
                endpoint_id: endpoint.id,
                name: paramData.name,
                type: paramData.type,
                required: paramData.required || false,
                description: paramData.description || null,
              })
                .fetch()
                .usingConnection(db);

              parameters.push(parameter);
            }
          }

          // Crear bodies
          const bodies = [];
          if (endpointData.bodies && Array.isArray(endpointData.bodies)) {
            for (const bodyData of endpointData.bodies) {
              const body = await ApiBody.create({
                id: uuidv4(),
                endpoint_id: endpoint.id,
                content_type: bodyData.content_type || "application/json",
                example: bodyData.example || null,
              })
                .fetch()
                .usingConnection(db);

              bodies.push(body);
            }
          }

          // Crear responses
          const responses = [];
          if (endpointData.responses && Array.isArray(endpointData.responses)) {
            for (const responseData of endpointData.responses) {
              if (!responseData.status_code) {
                sails.log.warn(
                  "Response sin status_code, saltando:",
                  responseData
                );
                continue;
              }

              const response = await ApiResponse.create({
                id: uuidv4(),
                endpoint_id: endpoint.id,
                status_code: responseData.status_code,
                content_type: responseData.content_type || "application/json",
                example: responseData.example || null,
              })
                .fetch()
                .usingConnection(db);

              responses.push(response);
            }
          }

          result.endpoints.push({
            endpoint,
            parameters,
            bodies,
            responses,
          });

          if (updateExisting) {
            result.totalUpdated++;
          } else {
            result.totalCreated++;
          }
        }

        sails.log.verbose(
          `Documentación registrada exitosamente. Endpoints procesados: ${result.endpoints.length}`
        );
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

      if (
        error.code === "E_API_NOT_FOUND" ||
        error.code === "E_VERSION_EXISTS"
      ) {
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
