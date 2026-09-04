const { Pool } = require("pg");

const config = require("../../config");

const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl
    ? { rejectUnauthorized: false }
    : false,
});

module.exports = pool;