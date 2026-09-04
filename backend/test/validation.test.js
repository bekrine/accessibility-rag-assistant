const test = require("node:test");
const assert = require("node:assert/strict");

const { updateIssueSchema } = require("../src/validation/issue");

test("accepts a valid partial update", () => {
  const result = updateIssueSchema.safeParse({
    severity: "High",
    status: "Open",
  });

  assert.equal(result.success, true);
});

test("accepts an empty update", () => {
  const result = updateIssueSchema.safeParse({});

  assert.equal(result.success, true);
});

test("rejects an invalid severity value", () => {
  const result = updateIssueSchema.safeParse({
    severity: "Critical",
  });

  assert.equal(result.success, false);
});

test("rejects unknown fields", () => {
  const result = updateIssueSchema.safeParse({
    id: "PN-9999",
  });

  assert.equal(result.success, false);
});
