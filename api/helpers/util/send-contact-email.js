/**
 * api/helpers/util/send-contact-email.js
 *
 * Envía un mensaje del formulario de contacto al equipo de CoreAPI.
 * Usa Resend (API HTTP) en lugar de SMTP porque Render bloquea SMTP.
 *
 * Requiere en config/local.js:
 *   resend: {
 *     apiKey: "re_xxxxxxxxxxxx",
 *     fromEmail: "CoreAPI <onboarding@resend.dev>",
 *   }
 */

const flaverr = require("flaverr");
const fs      = require("fs");
const path    = require("path");

module.exports = {
  friendlyName: "sendContactEmail",
  description: "Envía un email del formulario de contacto al equipo de CoreAPI.",

  inputs: {
    name:    { type: "string", required: true,  description: "Nombre del remitente." },
    email:   { type: "string", required: true,  description: "Correo del remitente." },
    message: { type: "string", required: true,  description: "Cuerpo del mensaje." },
    ip:      { type: "string", required: false, description: "IP del remitente para auditoría." },
  },

  fn: async function ({ name, email, message, ip }) {
    try {
      sails.log.verbose("\n--------> Enviando email de contacto via Resend...\n");

      const apiKey = sails.config.resend?.apiKey;
      if (!apiKey) {
        throw new Error("sails.config.resend.apiKey no está configurado.");
      }

      // ─── Cargar y rellenar plantilla HTML ─────────────────────────────
      const templatePath = path.join(
        __dirname, "..", "..", "..",
        "plantillas", "contact-email.html"
      );
      let html = fs.readFileSync(templatePath, "utf8");

      const escape = (s) => String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

      const timestamp = new Date().toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        dateStyle: "full",
        timeStyle: "short",
      });

      html = html
        .replace(/{{name}}/g,      escape(name))
        .replace(/{{email}}/g,     escape(email))
        .replace(/{{message}}/g,   escape(message))
        .replace(/{{timestamp}}/g, escape(timestamp))
        .replace(/{{ip}}/g,        escape(ip || "desconocida"));

      // ─── Destinatarios ────────────────────────────────────────────────
      const recipients = sails.config.contact?.recipients || [
        "lalfonso.castano@udea.edu.co",
        "jose.henao1@udea.edu.co",
        "andres.lema1@udea.edu.co",
      ];

      // ─── Llamada a Resend API ─────────────────────────────────────────
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          from:     "CoreAPI <onboarding@resend.dev>",
          to:       "andres.lema1@udea.edu.co",
          reply_to: `"${name}" <${email}>`,
          subject:  `📬 Nuevo mensaje de contacto — ${name}`,
          html,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        sails.log.error("Resend respondió con error:", response.status, errBody);
        throw new Error(`Resend ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      sails.log.info("Email enviado via Resend:", data.id);

      return { success: true, messageId: data.id };

    } catch (error) {
      sails.log.error("Error enviando email de contacto:", error.message);
      throw flaverr(
        { code: "EMAIL_SEND_FAILED", name: "EmailSendError" },
        error
      );
    }
  },
};
