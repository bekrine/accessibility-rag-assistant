const config = require("../../config");

async function answerTopicCountQuestion({ topic, severity, status, issueId }) {
  const response = await fetch(`${config.rag.serviceUrl}/count`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, severity, status, issueId }),
  });

  if (!response.ok) {
    throw new Error(`RAG service /count failed: ${response.status}`);
  }

  const data = await response.json();
  const count = data.count;

  const filterParts = [severity, status].filter(Boolean);
  const filterDescription =
    filterParts.length > 0 ? ` ${filterParts.join(" ")}` : "";

  return {
    answer: `There ${count === 1 ? "is" : "are"} ${count}${filterDescription} issue${
      count === 1 ? "" : "s"
    } related to "${topic}".`,
    sources: data.sources || [],
  };
}

module.exports = {
  answerTopicCountQuestion,
};
