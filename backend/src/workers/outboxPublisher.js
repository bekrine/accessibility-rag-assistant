require("dotenv").config();

const pool = require("../db");
const config = require("../../config");

const ragQueue = require("../queues/ragQueue");
let isPublishing = false;

async function publishOutboxEvents() {
      if (isPublishing) {
    return;
  }

  isPublishing = true;

    const client = await pool.connect();

    try {

        const result = await client.query(
            `
      SELECT *
      FROM outbox_events

      WHERE published_at IS NULL

      ORDER BY created_at ASC

      LIMIT 10

      FOR UPDATE SKIP LOCKED
      `
        );

        for (const event of result.rows) {

            console.log(
                `Publishing outbox event ${event.id}`
            );

            await ragQueue.add(
                event.event_type,
                {
                    ...event.payload,
                    eventId: event.id
                },
                {
                    jobId: event.id,
                }
            );

            await client.query(
                `
        UPDATE outbox_events

        SET published_at = CURRENT_TIMESTAMP

        WHERE id = $1
        `,
                [event.id]
            );

            console.log(
                `Outbox event ${event.id} published`
            );
        }

    } catch (error) {

        console.error(
            "Outbox publisher error:",
            error
        );

    } finally {

        client.release();
        isPublishing = false;
    }
}

// Scanned issues (id prefix "SCAN-") are ephemeral exploratory data from
// public visitors scanning arbitrary URLs, unlike the permanent seed issues
// (id prefix "PN-"). Without cleanup the knowledge base would grow forever
// as a public feature. Seed issues are never touched here.
const SCAN_RETENTION_HOURS = 24;
let isCleaningUp = false;

async function cleanupExpiredScans() {
  if (isCleaningUp) {
    return;
  }

  isCleaningUp = true;

  try {
    const result = await pool.query(
      `
      DELETE FROM issues
      WHERE id LIKE 'SCAN-%'
        AND created_at < NOW() - INTERVAL '${SCAN_RETENTION_HOURS} hours'
      RETURNING id
      `
    );

    if (result.rows.length === 0) {
      return;
    }

    const issueIds = result.rows.map((row) => row.id);

    console.log(
      `Cleaning up ${issueIds.length} expired scanned issue(s): ${issueIds.join(", ")}`
    );

    const response = await fetch(
      `${config.rag.serviceUrl}/sync/issues/delete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": config.security.internalApiKey,
        },
        body: JSON.stringify({ issueIds }),
      }
    );

    if (!response.ok) {
      console.error(
        `Failed to remove expired scans from the vector store: ${response.status}`
      );
    }
  } catch (error) {
    console.error("Scan cleanup error:", error);
  } finally {
    isCleaningUp = false;
  }
}

const publishInterval = setInterval(
  publishOutboxEvents,
  5000
);

const cleanupInterval = setInterval(
  cleanupExpiredScans,
  60 * 60 * 1000
);

console.log(
    "Outbox publisher is running..."
);

let shuttingDown = false;

async function shutdown(signal) {

  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `${signal} received. Shutting down outbox publisher...`
  );

  clearInterval(publishInterval);
  clearInterval(cleanupInterval);

  try {

    await pool.end();

    console.log(
      "PostgreSQL pool closed."
    );

    process.exit(0);

  } catch (error) {

    console.error(
      "Shutdown error:",
      error
    );

    process.exit(1);
  }
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);
