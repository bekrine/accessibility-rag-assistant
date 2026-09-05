const crypto = require("crypto");

const IMPACT_TO_SEVERITY = {
  critical: "High",
  serious: "High",
  moderate: "Medium",
  minor: "Low",
};

function extractWcag(tags = []) {
  const scTag = tags.find((tag) => /^wcag\d{3,4}$/.test(tag));

  if (scTag) {
    const digits = scTag.replace("wcag", "");
    const parts = [digits[0], digits[1], digits.slice(2)];
    return parts.join(".");
  }

  const levelTags = tags.filter((tag) => /^wcag2\d?a{1,3}$/.test(tag));
  return levelTags.length > 0 ? levelTags.join(", ") : "N/A";
}

function stableIssueId(url, code, selector) {
  const hash = crypto
    .createHash("sha1")
    .update(`${url}|${code}|${selector}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

  return `SCAN-${hash}`;
}

function mapAxeIssueToIssueRow(url, axeIssue) {
  const impact = axeIssue.runnerExtras?.impact;
  const tags = axeIssue.runnerExtras?.tags || [];
  const helpUrl = axeIssue.runnerExtras?.helpUrl;

  let page;
  try {
    page = new URL(url).pathname || "/";
  } catch {
    page = url;
  }

  const remediationParts = [
    axeIssue.runnerExtras?.help,
    helpUrl ? `More info: ${helpUrl}` : null,
  ].filter(Boolean);

  return {
    id: stableIssueId(url, axeIssue.code, axeIssue.selector),
    title: axeIssue.message.slice(0, 500),
    wcag: extractWcag(tags),
    severity: IMPACT_TO_SEVERITY[impact] || "Medium",
    status: "Open",
    page,
    url,
    description: `${axeIssue.message}\n\nAffected element: ${axeIssue.context}`.slice(
      0,
      5000
    ),
    remediation: (remediationParts.join(" ") || "No remediation guidance available.").slice(
      0,
      5000
    ),
  };
}

module.exports = {
  mapAxeIssueToIssueRow,
};
