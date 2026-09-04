require("dotenv").config();

const { Worker } = require("bullmq");

const redis = require("../config/redis");

const pool = require("../db");

const {
  syncIssueWithRag,
} = require("../services/rag");

const worker = new Worker(
  "rag-sync",

  async (job) => {

    console.log(
      `Processing RAG job ${job.id}`
    );

    const { issueId, eventId, } = job.data;

    console.log(
      `Synchronizing issue: ${issueId}`
    );
    const processedResult = await pool.query(
      `
  SELECT event_id
  FROM processed_events
  WHERE event_id = $1
  `,
      [eventId]
    );

    if (processedResult.rows.length > 0) {

      console.log(
        `Event ${eventId} already processed`
      );

      return {
        success: true,
        skipped: true,
        reason: "Event already processed",
      };
    }
    // 1. Get latest issue from PostgreSQL

    const result = await pool.query(
      `
      SELECT *
      FROM issues
      WHERE LOWER(id) = LOWER($1)
      `,
      [issueId]
    );

    if (result.rows.length === 0) {

      throw new Error(
        `Issue ${issueId} not found`
      );
    }

    const issue = result.rows[0];

    console.log(
      `Issue ${issue.id} loaded from PostgreSQL`
    );

    // 2. Synchronize with RAG service

    const ragResult =
      await syncIssueWithRag(issue);

    console.log(
      `Issue ${issue.id} synchronized with RAG`,
      ragResult
    );
    await pool.query(
      `
  INSERT INTO processed_events (event_id)
  VALUES ($1)
  ON CONFLICT (event_id) DO NOTHING
  `,
      [eventId]
    );
    return {
      success: true,
      issueId: issue.id,
      ragResult,
    };
  },

  {
    connection: redis,
    concurrency: 2,
  }
);

worker.on("completed", (job) => {

  console.log(
    `RAG job ${job.id} completed`
  );

});

worker.on("failed", (job, error) => {

  console.error(
    `RAG job ${job?.id} failed:`,
    error.message
  );

});

console.log(
  "RAG worker is running..."
);

let shuttingDown = false;

async function shutdown(signal) {

  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `${signal} received. Starting graceful shutdown...`
  );

  try {

    await worker.close();

    console.log(
      "BullMQ worker closed."
    );

    await pool.end();

    console.log(
      "PostgreSQL pool closed."
    );

    process.exit(0);

  } catch (error) {

    console.error(
      "Error during shutdown:",
      error
    );

    process.exit(1);
  }
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);