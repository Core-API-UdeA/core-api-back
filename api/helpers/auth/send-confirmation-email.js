const flaverr = require("flaverr");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

module.exports = {
  friendlyName: "sendConfirmationEmail",

  description: "Sends a confirmation email to the user using Gmail.",

  inputs: {
    to: {
      type: "string",
      required: true,
      description: "Correo electrónico del destinatario.",
    },
    name: {
      type: "string",
      required: true,
      description: "Nombre del destinatario.",
    },
    confirmationUrl: {
      type: "string",
      required: true,
      description: "URL de confirmación del correo.",
    },
  },

  fn: async function ({ to, name, confirmationUrl }) {
    try {
      sails.log.verbose("\n--------> Enviando correo de confirmación...\n");

      const templatePath = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "plantillas",
        "confirmation-email.html"
      );
      let htmlTemplate = fs.readFileSync(templatePath, "utf8");

      htmlTemplate = htmlTemplate
        .replace(/{{name}}/g, name)
        .replace(/{{confirmationUrl}}/g, confirmationUrl);

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: sails.config.register.user,
          pass: sails.config.register.pass,
        },
      });

      const mailOptions = {
        from: `"Core API" <${sails.config.register.user}>`,
        to: to,
        subject: "Confirma tu correo electrónico",
        html: htmlTemplate,
      };

      const info = await transporter.sendMail(mailOptions);
      sails.log.info("Correo enviado: ", info.messageId);

      return {
        success: true,
        messageId: info.messageId,
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
