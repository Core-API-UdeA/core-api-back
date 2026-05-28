/**
 * api/controllers/catalogo/generar-documentacion-ia.js
 *
 * Proxy hacia la API de Groq para generar documentación de endpoints.
 * Groq tiene capa gratuita generosa y es compatible con el formato OpenAI.
 * Centralizar la llamada en el back evita el bloqueo CORS del browser.
 *
 * Ruta:   POST /catalogo/generar-documentacion-ia
 * Policy: auth/is-authenticated
 *
 * Obtén tu API Key gratuita en: https://console.groq.com/keys
 */

module.exports = {
  friendlyName: 'Generar documentación con IA',
  description: 'Usa Groq (Llama) para generar endpoints, parámetros y ejemplos.',

  inputs: {
    nombre:             { type: 'string', required: true,  maxLength: 150  },
    tipo:               { type: 'string', required: true,  isIn: ['REST', 'GraphQL', 'SOAP', 'WebSocket'] },
    baseUrl:            { type: 'string', required: true,  maxLength: 500  },
    descripcion:        { type: 'string', required: true,  maxLength: 2000 },
    endpointsConocidos: { type: 'string', required: false, maxLength: 1000 },
    authType:           { type: 'string', required: false, isIn: ['none', 'api_key', 'bearer', 'oauth2'], defaultsTo: 'api_key' },
  },

  exits: {
    success:      { description: 'Documentación generada.', responseType: 'okResponse'  },
    iaError:      { description: 'Error de IA.',            responseType: 'nokResponse' },
    errorGeneral: { description: 'Error inesperado.',       responseType: 'nokResponse' },
  },

  fn: async function ({ nombre, tipo, baseUrl, descripcion, endpointsConocidos, authType }, exits) {
    sails.log.verbose('-----> Controller: Generar documentación IA (Groq) | api:', nombre);

    const apiKey = sails.config.groqApiKey || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return exits.iaError({
        mensaje: 'La clave de API de Groq no está configurada. Agrégala en config/local.js como groqApiKey.',
      });
    }

    // ─── Prompt ───────────────────────────────────────────────────────────
    const endpointsSugeridos = endpointsConocidos
      ? `\nEndpoints que el desarrollador ya conoce:\n${endpointsConocidos}`
      : '';

    const prompt = `Genera la documentación completa para esta API:

NOMBRE: ${nombre}
TIPO: ${tipo}
URL BASE: ${baseUrl}
AUTH: ${authType}
DESCRIPCIÓN: ${descripcion}
${endpointsSugeridos}

Responde ÚNICAMENTE con un JSON válido, sin texto extra, sin markdown, sin explicaciones:

{
  "endpoints": [
    {
      "path": "/ruta",
      "method": "GET",
      "description": "Qué hace este endpoint",
      "parameters": [
        { "name": "param", "type": "string", "required": true, "location": "query", "description": "Descripción", "example": "valor" }
      ],
      "headers": [],
      "bodies": [],
      "responses": [
        { "status_code": 200, "description": "Éxito", "example": { "campo": "valor" } },
        { "status_code": 400, "description": "Error", "example": { "error": "mensaje" } }
      ]
    }
  ]
}

REGLAS:
- Genera entre 3 y 8 endpoints realistas
- POST/PUT/PATCH deben tener "bodies", GET/DELETE no
- Ejemplos con datos realistas (no "string" ni "value")
- No incluir el header de autenticación en "headers" (se maneja aparte)`;

    // ─── Llamar a Groq (API compatible con OpenAI) ─────────────────────────
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model:       'llama-3.3-70b-versatile', // Modelo gratuito más capaz de Groq
          temperature: 0.2,                        // Baja temperatura para JSON consistente
          max_tokens:  4096,
          messages: [
            {
              role:    'system',
              content: 'Eres un experto en diseño de APIs REST. Generas documentación técnica precisa en formato JSON estrictamente válido. Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown, sin backticks.',
            },
            {
              role:    'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        sails.log.error('Error de Groq API:', response.status, errorBody);

        // Manejar rate limit específicamente
        if (response.status === 429) {
          return exits.iaError({
            mensaje: 'Límite de requests de Groq alcanzado. Espera un momento e intenta de nuevo.',
          });
        }

        return exits.iaError({
          mensaje: `Error de Groq: ${response.status} — ${response.statusText}`,
        });
      }

      const data    = await response.json();
      const rawText = data.choices?.[0]?.message?.content ?? '';

      if (!rawText) {
        throw new Error('Groq no retornó contenido.');
      }

      // Limpiar backticks residuales y parsear
      const clean  = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (!parsed.endpoints || !Array.isArray(parsed.endpoints)) {
        throw new Error('La IA no retornó un array de endpoints válido.');
      }

      sails.log.verbose(`Groq generó ${parsed.endpoints.length} endpoints para "${nombre}"`);

      return exits.success({
        mensaje: `Documentación generada: ${parsed.endpoints.length} endpoints`,
        data:    parsed,
      });

    } catch (error) {
      sails.log.error('Error al generar documentación con Groq:', error.message);

      if (error instanceof SyntaxError) {
        return exits.iaError({
          mensaje: 'La IA devolvió un formato inesperado. Intenta de nuevo con una descripción más detallada.',
        });
      }

      return exits.errorGeneral({
        mensaje: error.message || 'Error al comunicarse con la IA.',
      });
    }
  },
};
