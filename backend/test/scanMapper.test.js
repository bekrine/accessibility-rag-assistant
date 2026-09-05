const test = require("node:test");
const assert = require("node:assert/strict");

const { mapAxeIssueToIssueRow } = require("../src/services/scanMapper");

const baseAxeIssue = {
  code: "color-contrast",
  message: "Elements must meet minimum color contrast ratio thresholds",
  context: "<p>hello</p>",
  selector: "p",
  runner: "axe",
  runnerExtras: {
    description: "Ensure contrast ratio meets WCAG 2 AA",
    impact: "serious",
    help: "Elements must meet minimum color contrast ratio thresholds",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.13/color-contrast",
    tags: ["cat.color", "wcag2aa", "wcag143"],
  },
};

test("maps impact to severity", () => {
  const row = mapAxeIssueToIssueRow("https://example.com/", baseAxeIssue);
  assert.equal(row.severity, "High");

  const minorRow = mapAxeIssueToIssueRow("https://example.com/", {
    ...baseAxeIssue,
    runnerExtras: { ...baseAxeIssue.runnerExtras, impact: "minor" },
  });
  assert.equal(minorRow.severity, "Low");
});

test("extracts a WCAG success criterion tag into dotted form", () => {
  const row = mapAxeIssueToIssueRow("https://example.com/", baseAxeIssue);
  assert.equal(row.wcag, "1.4.3");
});

test("falls back to N/A when no success-criterion tag is present", () => {
  const row = mapAxeIssueToIssueRow("https://example.com/", {
    ...baseAxeIssue,
    runnerExtras: { ...baseAxeIssue.runnerExtras, tags: ["cat.structure"] },
  });
  assert.equal(row.wcag, "N/A");
});

test("generates a stable id for the same url/code/selector", () => {
  const rowA = mapAxeIssueToIssueRow("https://example.com/", baseAxeIssue);
  const rowB = mapAxeIssueToIssueRow("https://example.com/", baseAxeIssue);
  assert.equal(rowA.id, rowB.id);
});

test("generates different ids for different selectors on the same page", () => {
  const rowA = mapAxeIssueToIssueRow("https://example.com/", baseAxeIssue);
  const rowB = mapAxeIssueToIssueRow("https://example.com/", {
    ...baseAxeIssue,
    selector: "h1",
  });
  assert.notEqual(rowA.id, rowB.id);
});
