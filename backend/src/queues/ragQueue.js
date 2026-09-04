const { Queue } = require("bullmq");
const redis = require("../config/redis");

const ragQueue = new Queue("rag-sync", {
  connection: redis,
});

module.exports = ragQueue;