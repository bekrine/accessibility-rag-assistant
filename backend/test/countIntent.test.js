const test = require("node:test");
const assert = require("node:assert/strict");

const { answerCountQuestion } = require("../src/services/countIntent");

// These exercise the live database (docker compose up) since the count
// logic is a thin, deterministic wrapper around a real SQL query.

test("counts all issues with no filters", async () => {
  const result = await answerCountQuestion({ severity: null, status: null });

  assert.match(result.answer, /^There (is|are) \d+ issues? in the knowledge base\.$/);
  assert.deepEqual(result.sources, []);
});

test("counts issues filtered by severity", async () => {
  const result = await answerCountQuestion({ severity: "High", status: null });

  assert.match(result.answer, /matching High in the knowledge base\.$/);
});

test("counts issues filtered by severity and status", async () => {
  const result = await answerCountQuestion({
    severity: "Medium",
    status: "Open",
  });

  assert.match(result.answer, /matching Medium and Open in the knowledge base\.$/);
});
