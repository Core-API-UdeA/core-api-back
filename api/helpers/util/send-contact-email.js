/**
 * api/helpers/util/send-contact-email.js
 *
 * Envía un mensaje del formulario de contacto al equipo de CoreAPI.
 * Reutiliza la configuración SMTP de Gmail ya existente (sails.config.register).
 */

const flaverr     = require("flaverr");
const nodemailer  = require("nodemailer");
const fs          = require("fs");
const path        = require("path");

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
      sails.log.verbose("\n--------> Enviando email de contacto...\n");

      // Cargar plantilla HTML
      const templatePath = path.join(
        __dirname, "..", "..", "..",
        "plantillas", "contact-email.html"
      );
      let html = fs.readFileSync(templatePath, "utf8");

      // Sanitizar para evitar HTML injection en el preview del cliente de correo
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

      // Transporter (mismo de send-confirmation-email)
      const transporter = nodemailer.createTransport({
        host:   "smtp.gmail.com",
        port:   465,
        secure: true,
        auth: {
          user: sails.config.register.user,
          pass: sails.config.register.pass,
        },
      });

      // Destinatarios — pueden estar todos en sails.config.contact.recipients
      // o usar los del equipo por defecto
      const recipients = sails.config.contact?.recipients || [
        "lalfonso.castano@udea.edu.co",
        "jose.henao1@udea.edu.co",
        "andres.lema1@udea.edu.co",
      ];

      const mailOptions = {
        from:    `"CoreAPI Contacto" <${sails.config.register.user}>`,
        to:      recipients.join(", "),
        replyTo: `"${name}" <${email}>`,   // permite responder directamente al usuario
        subject: `📬 Nuevo mensaje de contacto — ${name}`,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      sails.log.info("Email de contacto enviado:", info.messageId);

      return { success: true, messageId: info.messageId };

    } catch (error) {
      sails.log.error("Error enviando email de contacto:", error.message);
      throw flaverr(
        { code: "EMAIL_SEND_FAILED", name: "EmailSendError" },
        error
      );
    }
  },
};
