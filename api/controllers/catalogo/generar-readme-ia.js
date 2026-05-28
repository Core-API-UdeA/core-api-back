/**
 * api/controllers/catalogo/generar-readme-ia.js
 *
 * Genera un README profesional en Markdown usando Groq (Llama gratuito).
 *
 * Ruta:   POST /catalogo/generar-readme-ia
 * Policy: auth/is-authenticated
 */

module.exports = {
  friendlyName: 'Generar README con IA',
  description:  'Genera un README en Markdown a partir del título, tipo y resumen de la API.',

  inputs: {
    titulo:      { type: 'string', required: true,  maxLength: 150  },
    tipo:        { type: 'string', required: true,  maxLength: 50   },
    resumen:     { type: 'string', required: false, maxLength: 1000 },
    tecnologias: { type: 'string', required: false, maxLength: 500  },
  },

  exits: {
    success:      { description: 'README generado.',  responseType: 'okResponse'  },
    iaError:      { description: 'Error de IA.',      responseType: 'nokResponse' },
    errorGeneral: { description: 'Error inesperado.', responseType: 'nokResponse' },
  },

  fn: async function ({ titulo, tipo, resumen, tecnologias }, exits) {
    sails.log.verbose('-----> Controller: Generar README IA | api:', titulo);

    const apiKey = sails.config.groqApiKey || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return exits.iaError({
        mensaje: 'La clave de API de Groq no está configurada. Agrégala en config/local.js como groqApiKey.',
      });
    }

    const stackInfo = tecnologias
      ? `\nStack tecnológico: ${tecnologias}`
      : '';

    const prompt = `Genera un README profesional en Markdown para esta API:

Nombre: ${titulo}
Tipo: ${tipo}
Descripción: ${resumen || 'API de servicios web'}${stackInfo}

El README debe tener estas secciones en este orden:
1. Título con emoji representativo
2. Descripción breve (1-2 párrafos)
3. ## Características (lista de bullets con los puntos fuertes)
4. ## Tecnologías (si se proporcionaron)
5. ## Empezar (3 pasos simples: suscribirse, obtener key, hacer la primera llamada)
6. ## Ejemplo de uso (un ejemplo cURL realista con la URL del gateway de CoreAPI)
7. ## Endpoints disponibles (tabla simple con método, ruta y descripción — inventar 3-4 ejemplos basados en el tipo de API)
8. ## Soporte (email de soporte ficticio)

REGLAS:
- Usa Markdown válido con headers ##, bullets -, código con backticks
- El ejemplo cURL debe usar: curl -H "X-Api-Key: TU_API_KEY" https://coreapi.com/gateway/SLUG/ruta
- Sé conciso pero completo — máximo 400 palabras
- Responde SOLO con el contenido Markdown, sin texto extra antes ni después`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model:       'llama-3.3-70b-versatile',
          temperature: 0.6,   // Un poco más alto para más variedad en el texto
          max_tokens:  1500,
          messages: [
            {
              role:    'system',
              content: 'Eres un experto técnico en documentación de APIs. Generas READMEs profesionales, claros y concisos en Markdown. Respondes ÚNICAMENTE con el contenido Markdown solicitado, sin explicaciones adicionales.',
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
        sails.log.error('Error de Groq API (README):', response.status, errorBody);

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
      const readme  = data.choices?.[0]?.message?.content ?? '';

      if (!readme) {
        throw new Error('Groq no retornó contenido.');
      }

      sails.log.verbose(`README generado para "${titulo}" (${readme.length} chars)`);

      return exits.success({
        mensaje: 'README generado exitosamente',
        data:    { readme: readme.trim() },
      });

    } catch (error) {
      sails.log.error('Error al generar README con IA:', error.message);
      return exits.errorGeneral({
        mensaje: error.message || 'Error al comunicarse con la IA.',
      });
    }
  },
};
