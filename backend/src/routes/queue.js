const express = require("express");

const {
  getRagQueueStats,
  getFailedRagJobs,
} = require("../services/queueMonitor");
const requireInternalKey = require("../middleware/requireInternalKey");

const router = express.Router();

router.use(requireInternalKey);

router.get("/rag", async (req, res) => {
  try {
    const stats = await getRagQueueStats();

    res.json(stats);

  } catch (error) {
    console.error(
      "Failed to get queue stats:",
      error
    );

    res.status(500).json({
      message: "Failed to get queue stats",
    });
  }
});

router.get("/rag/failed", async (req, res) => {
  try {
    const jobs = await getFailedRagJobs();

    res.json({
      count: jobs.length,
      jobs,
    });

  } catch (error) {
    console.error(
      "Failed to get failed jobs:",
      error
    );

    res.status(500).json({
      message: "Failed to get failed jobs",
    });
  }
});

module.exports = router;