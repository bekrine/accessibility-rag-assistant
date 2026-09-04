const config = require("../../config");

function requireInternalKey(req, res, next) {
  const providedKey = req.header("x-internal-api-key");

  if (
    !config.security.internalApiKey ||
    providedKey !== config.security.internalApiKey
  ) {
    return res.status(401).json({
      message: "Missing or invalid internal API key",
    });
  }

  next();
}

module.exports = requireInternalKey;
