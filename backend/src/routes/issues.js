const express = require("express");


const pool = require("../db");
const requireInternalKey = require("../middleware/requireInternalKey");
const { updateIssueSchema } = require("../validation/issue");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM issues ORDER BY created_at DESC"
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch issues:", error);

    res.status(500).json({
      message: "Failed to fetch issues",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM issues WHERE LOWER(id) = LOWER($1)",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to fetch issue:", error);

    res.status(500).json({
      message: "Failed to fetch issue",
    });
  }
});
router.put("/:id", requireInternalKey, async (req, res) => {
  const parseResult = updateIssueSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parseResult.error.issues,
    });
  }

  const {
    title,
    wcag,
    severity,
    status,
    page,
    url,
    description,
    remediation,
  } = parseResult.data;

  const dbClient = await pool.connect();

  try {
    //start the transaction
      await dbClient.query("BEGIN");
        // Update issue
    const result = await dbClient.query(
      `
      UPDATE issues
      SET
        title = COALESCE($1, title),
        wcag = COALESCE($2, wcag),
        severity = COALESCE($3, severity),
        status = COALESCE($4, status),
        page = COALESCE($5, page),
        url = COALESCE($6, url),
        description = COALESCE($7, description),
        remediation = COALESCE($8, remediation),
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(id) = LOWER($9)
      RETURNING *
      `,
      [
        title,
        wcag,
        severity,
        status,
        page,
        url,
        description,
        remediation,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      await dbClient.query("ROLLBACK")
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    const issue = result.rows[0];
      // Create outbox event
    await dbClient.query(
      `
      INSERT INTO outbox_events (
        event_type,
        aggregate_type,
        aggregate_id,
        payload
      )
      VALUES ($1, $2, $3, $4)
      `,
      [
        "issue.updated",
        "issue",
        issue.id,
        JSON.stringify({
          issueId: issue.id,
        }),
      ]
    );
     // Commit both operations
    await dbClient.query("COMMIT");
    
    res.json({
      message: "Issue updated successfully",
      issue,
    });


  } catch (error) {
    console.error("Issue update error:", error);

    try {
      await dbClient.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    res.status(500).json({
      message: "Failed to update issue",
    });
  } finally {
    dbClient.release();
  }
});

module.exports = router;