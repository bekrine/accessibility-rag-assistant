const pool = require("../db");

const COUNT_PATTERN = /how many|number of|count of|total number/i;

function detectCountFilters(message) {
  const lower = message.toLowerCase();
  const conditions = [];
  const params = [];

  if (/\bhigh severity\b|\bhigh-severity\b/.test(lower)) {
    conditions.push(`severity = $${params.length + 1}`);
    params.push("High");
  } else if (/\bmedium severity\b|\bmedium-severity\b/.test(lower)) {
    conditions.push(`severity = $${params.length + 1}`);
    params.push("Medium");
  } else if (/\blow severity\b|\blow-severity\b/.test(lower)) {
    conditions.push(`severity = $${params.length + 1}`);
    params.push("Low");
  }

  if (/\bin progress\b/.test(lower)) {
    conditions.push(`status = $${params.length + 1}`);
    params.push("In Progress");
  } else if (/\bresolved\b/.test(lower)) {
    conditions.push(`status = $${params.length + 1}`);
    params.push("Resolved");
  } else if (/\bopen\b/.test(lower)) {
    conditions.push(`status = $${params.length + 1}`);
    params.push("Open");
  }

  return { conditions, params };
}

function describeFilters(conditions, params) {
  if (conditions.length === 0) {
    return "";
  }

  return ` matching ${params.join(" and ")}`;
}

async function tryAnswerCountQuestion(message) {
  if (!COUNT_PATTERN.test(message)) {
    return null;
  }

  const { conditions, params } = detectCountFilters(message);

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT COUNT(*) FROM issues ${whereClause}`,
    params
  );

  const count = Number(result.rows[0].count);
  const description = describeFilters(conditions, params);

  return {
    answer: `There ${count === 1 ? "is" : "are"} ${count} issue${
      count === 1 ? "" : "s"
    }${description} in the knowledge base.`,
    sources: [],
  };
}

function isCountQuestion(message) {
  return COUNT_PATTERN.test(message);
}

module.exports = {
  tryAnswerCountQuestion,
  isCountQuestion,
  detectCountFilters,
};
