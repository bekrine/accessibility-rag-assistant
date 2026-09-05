const pool = require("../db");

function describeFilters(severity, status) {
  const parts = [severity, status].filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return ` matching ${parts.join(" and ")}`;
}

async function answerCountQuestion({ severity, status }) {
  const conditions = [];
  const params = [];

  if (severity) {
    params.push(severity);
    conditions.push(`severity = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT COUNT(*) FROM issues ${whereClause}`,
    params
  );

  const count = Number(result.rows[0].count);
  const description = describeFilters(severity, status);

  return {
    answer: `There ${count === 1 ? "is" : "are"} ${count} issue${
      count === 1 ? "" : "s"
    }${description} in the knowledge base.`,
    sources: [],
  };
}

module.exports = {
  answerCountQuestion,
};
