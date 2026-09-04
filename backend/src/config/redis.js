const Redis = require("ioredis");
const config = require("../../config");

const redis = new Redis({
  host:config.redis.host,
  port:config.redis.port,
  maxRetriesPerRequest:null,
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

module.exports = redis;