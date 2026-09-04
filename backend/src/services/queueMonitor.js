const ragQueue = require("../queues/ragQueue");

async function getRagQueueStats() {
  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
  ] = await Promise.all([
    ragQueue.getWaitingCount(),
    ragQueue.getActiveCount(),
    ragQueue.getCompletedCount(),
    ragQueue.getFailedCount(),
    ragQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}
async function getFailedRagJobs() {
  const jobs = await ragQueue.getFailed();

  return jobs.map((job) => ({
    id: job.id,
    name: job.name,
    data: job.data,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
  }));
}

module.exports = {
  getRagQueueStats,getFailedRagJobs
};