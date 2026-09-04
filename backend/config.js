require("dotenv").config();

const requiredEnv = [
  "DATABASE_URL",
];

for (const variable of requiredEnv) {

  if (!process.env[variable]) {

    throw new Error(
      `Missing required environment variable: ${variable}`
    );
  }
}

const config = {
  server: {
    port: Number(process.env.PORT || 5000),
  },

  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true",
  },

  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  },

  rag: {
    serviceUrl:
      process.env.RAG_SERVICE_URL ||
      "http://localhost:8000",
  },

  security: {
    internalApiKey: process.env.INTERNAL_API_KEY,
  },

  frontend: {
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  },
};

module.exports = config;