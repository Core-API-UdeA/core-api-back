/**
 * api/controllers/util/enviar-contacto.js
 *
 * Recibe el formulario público de contacto y dispara el email al equipo.
 *
 * Defensa anti-spam por capas:
 *   1. Honeypot:        campo oculto "website" que solo bots llenan
 *   2. Tiempo mínimo:   los humanos tardan >2s en llenar el form
 *   3. Rate limit IP:   máximo 3 envíos por IP por hora
 *   4. Validación:      tamaños y formato del email
 *   5. Detección spam:  patrones obvios (URLs múltiples, palabras clave)
 *
 * Ruta:   POST /util/contacto
 * Policy: true (pública)
 */

// ─── Almacén en memoria para rate limiting por IP ─────────────────────────
// (Se reinicia con el servidor; suficiente para anti-spam básico.
//  Para producción robusta, migrar a Redis.)
const enviosPorIP = new Map(); // ip -> [{ timestamp }, ...]

const VENTANA_MS      = 60 * 60 * 1000; // 1 hora
const MAX_POR_VENTANA = 3;              // 3 emails por IP por hora

function _limpiarYContar(ip) {
  const ahora    = Date.now();
  const envios   = enviosPorIP.get(ip) || [];
  const vigentes = envios.filter(t => ahora - t < VENTANA_MS);
  enviosPorIP.set(ip, vigentes);
  return vigentes.length;
}

function _registrarEnvio(ip) {
  const envios = enviosPorIP.get(ip) || [];
  envios.push(Date.now());
  enviosPorIP.set(ip, envios);
}

// ─── Detección de patrones de spam ────────────────────────────────────────
function _pareceSpam(name, email, message) {
  const txt = `${name} ${message}`.toLowerCase();

  // 3+ URLs en el mensaje
  const urls = message.match(/https?:\/\//gi) || [];
  if (urls.length >= 3) return "urls múltiples";

  // Palabras clave típicas de spam (lista mínima, ampliable)
  const palabras = [
    "viagra", "cialis", "casino", "lottery", "bitcoin doubling",
    "make money fast", "click here", "weight loss", "buy followers",
  ];
  if (palabras.some(p => txt.includes(p))) return "palabras spam";

  // Solo mayúsculas en mensajes largos
  if (message.length > 30 && message === message.toUpperCase()) {
    return "todo mayúsculas";
  }

  return null;
}

// ─── Controller ───────────────────────────────────────────────────────────
module.exports = {
  friendlyName: "Enviar mensaje de contacto",
  description: "Recibe el formulario público de contacto, lo valida y dispara el email al equipo.",

  inputs: {
    name: {
      type: "string", required: true, minLength: 2, maxLength: 100,
      description: "Nombre del remitente.",
    },
    email: {
      type: "string", required: true, isEmail: true, maxLength: 150,
      description: "Correo del remitente.",
    },
    message: {
      type: "string", required: true, minLength: 10, maxLength: 2000,
      description: "Cuerpo del mensaje.",
    },
    // ── Campos anti-spam ─────────────────────────────────────────────────
    website: {
      type: "string", required: false, defaultsTo: "",
      description: "HONEYPOT — los humanos NO lo llenan, los bots sí.",
    },
    elapsedMs: {
      type: "number", required: false, defaultsTo: 0,
      description: "Milisegundos transcurridos desde que se cargó el form.",
    },
  },

  exits: {
    success:      { description: "Mensaje enviado.",        responseType: "okResponse"  },
    tooManyTries: { description: "Rate limit excedido.",    responseType: "nokResponse" },
    spamDetected: { description: "Detectado como spam.",    responseType: "okResponse"  }, // respuesta neutra
    invalidInput: { description: "Datos inválidos.",        responseType: "nokResponse" },
    errorGeneral: { description: "Error al enviar email.",  responseType: "nokResponse" },
  },

  fn: async function ({ name, email, message, website, elapsedMs }, exits) {
    const req = this.req;
    const ip = (req.headers["x-forwarded-for"]?.split(",")[0] ||
                req.connection?.remoteAddress ||
                "unknown").trim();

    sails.log.verbose(`-----> Contacto recibido | ip: ${ip} | de: ${email}`);

    // ─── Defensa 1: Honeypot ─────────────────────────────────────────────
    if (website && website.trim().length > 0) {
      sails.log.warn(`[contacto] BOT detectado (honeypot lleno) | ip: ${ip}`);
      // Respuesta de éxito FALSO para no dar pistas al bot
      return exits.spamDetected({
        mensaje: "Mensaje recibido correctamente.",
        data: { success: true },
      });
    }

    // ─── Defensa 2: Tiempo mínimo (>2s) ──────────────────────────────────
    if (elapsedMs > 0 && elapsedMs < 2000) {
      sails.log.warn(`[contacto] Form llenado demasiado rápido (${elapsedMs}ms) | ip: ${ip}`);
      return exits.spamDetected({
        mensaje: "Mensaje recibido correctamente.",
        data: { success: true },
      });
    }

    // ─── Defensa 3: Rate limit por IP ────────────────────────────────────
    const envios = _limpiarYContar(ip);
    if (envios >= MAX_POR_VENTANA) {
      sails.log.warn(`[contacto] Rate limit excedido | ip: ${ip} | envíos: ${envios}`);
      return exits.tooManyTries({
        mensaje: `Has alcanzado el límite de ${MAX_POR_VENTANA} mensajes por hora. Por favor intenta más tarde.`,
      });
    }

    // ─── Defensa 4: Validación adicional ─────────────────────────────────
    // Email del remitente vs destinatarios (no enviar a uno mismo)
    if (email.toLowerCase() === sails.config.register?.user?.toLowerCase()) {
      return exits.invalidInput({
        mensaje: "El correo del remitente no es válido.",
      });
    }

    // ─── Defensa 5: Detección de patrones de spam ────────────────────────
    const motivo = _pareceSpam(name, email, message);
    if (motivo) {
      sails.log.warn(`[contacto] Posible spam (${motivo}) | ip: ${ip} | email: ${email}`);
      return exits.spamDetected({
        mensaje: "Mensaje recibido correctamente.",
        data: { success: true },
      });
    }

    // ─── Enviar ──────────────────────────────────────────────────────────
    try {
      await sails.helpers.util.sendContactEmail.with({
        name, email, message, ip,
      });

      _registrarEnvio(ip);

      return exits.success({
        mensaje: "¡Gracias! Tu mensaje fue enviado. Te responderemos pronto.",
        data: { success: true },
      });

    } catch (error) {
      sails.log.error("[contacto] Error al enviar:", error.message);
      return exits.errorGeneral({
        mensaje: "No pudimos enviar tu mensaje en este momento. Por favor intenta más tarde.",
      });
    }
  },
};
