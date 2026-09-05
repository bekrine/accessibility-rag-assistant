const express = require("express");
const rateLimit = require("express-rate-limit");

const pool = require("../db");
const config = require("../../config");
const { scanRequestSchema } = require("../validation/scan");
const { mapAxeIssueToIssueRow } = require("../services/scanMapper");

const router = express.Router();

const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many scan requests. Please wait a while and try again.",
  },
});

async function upsertIssueWithOutboxEvent(issue) {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");

    const result = await dbClient.query(
      `
      INSERT INTO issues (
        id, title, wcag, severity, status, page, url, description, remediation
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id)
      DO UPDATE SET
        title = EXCLUDED.title,
        wcag = EXCLUDED.wcag,
        severity = EXCLUDED.severity,
        status = EXCLUDED.status,
        page = EXCLUDED.page,
        url = EXCLUDED.url,
        description = EXCLUDED.description,
        remediation = EXCLUDED.remediation,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [
        issue.id,
        issue.title,
        issue.wcag,
        issue.severity,
        issue.status,
        issue.page,
        issue.url,
        issue.description,
        issue.remediation,
      ]
    );

    const savedIssue = result.rows[0];

    await dbClient.query(
      `
      INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
      VALUES ($1, $2, $3, $4)
      `,
      [
        "issue.scanned",
        "issue",
        savedIssue.id,
        JSON.stringify({ issueId: savedIssue.id }),
      ]
    );

    await dbClient.query("COMMIT");

    return savedIssue;
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
}

router.post("/", scanLimiter, async (req, res) => {
  const parseResult = scanRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parseResult.error.issues,
    });
  }

  const { url } = parseResult.data;

  try {
    const scanResponse = await fetch(`${config.scanner.serviceUrl}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!scanResponse.ok) {
      const errorBody = await scanResponse.json().catch(() => ({}));

      return res.status(scanResponse.status === 400 ? 400 : 502).json({
        message: errorBody.message || "Scan failed",
      });
    }

    const scanData = await scanResponse.json();

    const savedIssues = [];

    for (const axeIssue of scanData.issues) {
      const mappedIssue = mapAxeIssueToIssueRow(scanData.url, axeIssue);
      const savedIssue = await upsertIssueWithOutboxEvent(mappedIssue);
      savedIssues.push(savedIssue);
    }

    res.json({
      url: scanData.url,
      issuesFound: savedIssues.length,
      issues: savedIssues,
    });
  } catch (error) {
    console.error("Scan route error:", error);

    res.status(500).json({
      message: "Failed to complete scan",
    });
  }
});

module.exports = router;
