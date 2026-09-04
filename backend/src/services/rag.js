const config = require("../../config");

async function syncIssueWithRag(issue) {
  const response = await fetch(
    `${config.rag.serviceUrl}/sync/issue`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": config.security.internalApiKey,
      },

      body: JSON.stringify(issue),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `RAG issue sync failed: ${response.status} - ${errorText}`
    );
  }

  return response.json();
}

module.exports = {
  syncIssueWithRag,
};