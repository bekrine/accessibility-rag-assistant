const issues = require("../data/issues");
const pool = require("../db");

async function migrateIssues() {
  try {
    for (const issue of issues) {
      await pool.query(
        `
        INSERT INTO issues (
          id,
          title,
          wcag,
          severity,
          status,
          page,
          url,
          description,
          remediation
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
    }

    console.log(
      `${issues.length} issues migrated successfully`
    );

  } catch (error) {
    console.error(
      "Issue migration failed:",
      error
    );
  } finally {
    await pool.end();
  }
}

migrateIssues();