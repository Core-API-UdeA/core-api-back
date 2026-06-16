require("dotenv").config({ quiet: true });

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

module.exports = {
  prefix: process.env.PREFIX || "/scapi",

  // JWT configuration
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "4h",
  issuer: process.env.JWT_ISSUER || "core-api-auth",

  auth: {
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
  },

  register: {
    user: process.env.REGISTER_USER,
    pass: process.env.REGISTER_PASS,
    from: process.env.REGISTER_FROM,
    emailConfirmationTokenTTL: numberFromEnv(
      "EMAIL_CONFIRMATION_TOKEN_TTL",
      24 * 60 * 60 * 1000
    ),
    urlConfirmacion: process.env.URL_CONFIRMACION,
  },

  // Mercado Pago
  mercadoPagoAccessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
  mercadoPagoPublicKey: process.env.MERCADO_PAGO_PUBLIC_KEY,
  mercadoPagoMode: process.env.MERCADO_PAGO_MODE || "sandbox",

  // Application URLs
  baseUrl: process.env.BASE_URL,
  frontendUrl: process.env.FRONTEND_URL,

  // Platform fee percentage
  platformFeePercentage: numberFromEnv("PLATFORM_FEE_PERCENTAGE", 10),

  // Gateway configuration
  GATEWAY_ENCRYPTION_KEY: process.env.GATEWAY_ENCRYPTION_KEY,

  groqApiKey: process.env.GROQ_API_KEY,

  contact: {
    recipients: [
      ...(process.env.CONTACT_RECIPIENTS
        ? process.env.CONTACT_RECIPIENTS.split(",").map((email) => email.trim())
        : []),
    ],
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
  },
};
