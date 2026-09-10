const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLastResults,
  filterScopedResults,
  answerScopedCount,
  answerScopedSearch,
} = require("../src/services/scopedResults");

const scanResults = [
  { issue_id: "SCAN-1", title: "Missing alt text", severity: "High", status: "Open" },
  { issue_id: "SCAN-2", title: "Low contrast", severity: "Medium", status: "Open" },
];

test("getLastResults finds the most recent assistant turn with sources", () => {
  const history = [
    { role: "user", content: "scan example.com" },
    { role: "assistant", content: "Scanned and found 2 issues.", sources: scanResults },
    { role: "user", content: "thanks" },
  ];

  assert.deepEqual(getLastResults(history), scanResults);
});

test("getLastResults returns empty when nothing has sources", () => {
  const history = [
    { role: "user", content: "hi" },
    { role: "assistant", content: "Hello!" },
  ];

  assert.deepEqual(getLastResults(history), []);
});

test("getLastResults picks the MOST RECENT sourced turn, not an older one", () => {
  const olderResults = [{ issue_id: "OLD-1", severity: "Low", status: "Open" }];
  const history = [
    { role: "assistant", content: "first scan", sources: olderResults },
    { role: "user", content: "scan another site" },
    { role: "assistant", content: "second scan", sources: scanResults },
  ];

  assert.deepEqual(getLastResults(history), scanResults);
});

test("filterScopedResults narrows by severity and status", () => {
  assert.equal(filterScopedResults(scanResults, { severity: "High" }).length, 1);
  assert.equal(
    filterScopedResults(scanResults, { severity: null, status: "Open" }).length,
    2
  );
  assert.equal(
    filterScopedResults(scanResults, { severity: "Low" }).length,
    0
  );
});

test("answerScopedCount reports how many of the last results match", () => {
  const result = answerScopedCount(scanResults, { severity: "High", status: null });

  assert.equal(result.answer, "1 of the 2 issues just found is High severity.");
  assert.equal(result.sources.length, 1);
});

test("answerScopedSearch lists matching issues from the last results", () => {
  const result = answerScopedSearch(scanResults, { severity: "Medium", status: null });

  assert.match(result.answer, /SCAN-2: Low contrast/);
  assert.equal(result.sources.length, 1);
});

test("answerScopedSearch handles no matches gracefully", () => {
  const result = answerScopedSearch(scanResults, { severity: "Low", status: null });

  assert.equal(result.answer, "None of the issues just found match that.");
  assert.deepEqual(result.sources, []);
});
