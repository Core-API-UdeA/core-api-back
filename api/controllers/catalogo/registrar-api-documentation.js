module.exports = {
  friendlyName: "Registar API Documentation",

  description: "Crear API - Documentation",

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

  exits: {
    success: {
      description: "API Documentation retrieved successfully.",
      responseType: "okResponse",
    },
    errorGeneral: {
      description: "Unexpected error while retrieving API Documentation.",
      responseType: "nokResponse",
    },
  },

  fn: async function (
    { apiId, versionName, changelog, endpoints, updateExisting },
    exits
  ) {
    sails.log.verbose("-----> Controller: Register API Documentation");

    try {
      const apiDocumentation =
        await sails.helpers.catalogo.registrarApiDocumentation.with({
          apiId,
          versionName,
          changelog,
          endpoints,
          updateExisting,
        });

      return exits.success({
        mensaje: "API Documentation retrieved successfully.",
        data: apiDocumentation,
      });
    } catch (error) {
      sails.log.error("Error retrieving API Documentation:", error);
      return exits.errorGeneral(error.message);
    }
  },
};
