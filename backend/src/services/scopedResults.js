// Resolves questions that refer to "them"/"those"/"the ones you found" back
// to the specific set of issues most recently shown in THIS conversation
// (e.g. right after a scan), rather than falling back to a global query
// against the whole shared knowledge base. Since conversation history is
// per-browser client state, this also keeps concurrent visitors' follow-up
// questions correctly isolated from each other.

function getLastResults(history) {
  if (!history || history.length === 0) {
    return [];
  }

  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];

    if (
      turn.role === "assistant" &&
      Array.isArray(turn.sources) &&
      turn.sources.length > 0
    ) {
      return turn.sources;
    }
  }

  return [];
}

function filterScopedResults(results, { severity, status }) {
  return results.filter(
    (result) =>
      (!severity || result.severity === severity) &&
      (!status || result.status === status)
  );
}

function describeFilter(severity, status) {
  const parts = [];

  if (severity) {
    parts.push(`${severity} severity`);
  }

  if (status) {
    parts.push(status);
  }

  return parts.length > 0 ? ` ${parts.join(", ")}` : "";
}

function answerScopedCount(lastResults, { severity, status }) {
  const matched = filterScopedResults(lastResults, { severity, status });
  const filterDescription = describeFilter(severity, status);

  return {
    answer: `${matched.length} of the ${lastResults.length} issue${
      lastResults.length === 1 ? "" : "s"
    } just found ${matched.length === 1 ? "is" : "are"}${filterDescription}.`,
    sources: matched,
  };
}

function answerScopedSearch(lastResults, { severity, status }) {
  const matched = filterScopedResults(lastResults, { severity, status });

  if (matched.length === 0) {
    return {
      answer: "None of the issues just found match that.",
      sources: [],
    };
  }

  const lines = matched.map(
    (issue) => `- ${issue.issue_id}: ${issue.title} (${issue.severity}, ${issue.status})`
  );

  return {
    answer: `Here ${matched.length === 1 ? "is" : "are"} the matching issue${
      matched.length === 1 ? "" : "s"
    } from the results just found:\n\n${lines.join("\n")}`,
    sources: matched,
  };
}

module.exports = {
  getLastResults,
  filterScopedResults,
  answerScopedCount,
  answerScopedSearch,
};
