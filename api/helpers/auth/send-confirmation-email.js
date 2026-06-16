/**
 * api/helpers/auth/send-confirmation-email.js
 *
 * Envía el email de confirmación de cuenta usando Resend (API HTTP).
 * Migrado de SMTP porque Render bloquea SMTP (puertos 465 y 587).
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
  friendlyName: "sendConfirmationEmail",
  description: "Sends a confirmation email to the user using Resend (HTTP API).",

  inputs: {
    to: {
      type: "string", required: true,
      description: "Correo electrónico del destinatario.",
    },
    name: {
      type: "string", required: true,
      description: "Nombre del destinatario.",
    },
    confirmationUrl: {
      type: "string", required: true,
      description: "URL de confirmación del correo.",
    },
  },

  fn: async function ({ to, name, confirmationUrl }) {
    try {
      sails.log.verbose("\n--------> Enviando correo de confirmación via Resend...\n");

      const apiKey = sails.config.resend?.apiKey;
      if (!apiKey) {
        throw new Error("sails.config.resend.apiKey no está configurado.");
      }

      // ─── Cargar plantilla HTML ─────────────────────────────────────────
      const templatePath = path.join(
        __dirname, "..", "..", "..",
        "plantillas", "confirmation-email.html"
      );
      let htmlTemplate = fs.readFileSync(templatePath, "utf8");

      htmlTemplate = htmlTemplate
        .replace(/{{name}}/g, name)
        .replace(/{{confirmationUrl}}/g, confirmationUrl);

      // ─── Llamada a Resend API ──────────────────────────────────────────
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          from:    "CoreAPI <onboarding@resend.dev>",
          to:      to,
          subject: "Confirma tu correo electrónico",
          html:    htmlTemplate,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        sails.log.error("Resend respondió con error:", response.status, errBody);
        throw new Error(`Resend ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      sails.log.info("Correo de confirmación enviado:", data.id);

      return {
        success: true,
        messageId: data.id,
      };

    } catch (error) {
      sails.log.error("Error enviando correo de confirmación:", error.message);
      throw flaverr(
        { code: "EMAIL_SEND_FAILED", name: "EmailSendError" },
        error
      );
    }
  },
};
