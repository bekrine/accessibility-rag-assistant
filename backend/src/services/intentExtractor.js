const VALID_SEVERITIES = ["High", "Medium", "Low"];
const VALID_STATUSES = ["Open", "In Progress", "Resolved"];

const FALLBACK_INTENT = {
  intent: "search",
  severity: null,
  status: null,
  issueId: null,
  topic: null,
};

const SYSTEM_PROMPT = `You are an intent classifier for an accessibility issue tracker chatbot.

You will be given the recent conversation history (if any) and the user's current message.

Reply with ONLY a JSON object (no other text, no markdown fences) describing the CURRENT message, with these fields:
- "intent": either "count" (the user wants a total/number of issues) or "search" (the user wants to know about, discuss, or be shown specific issues)
- "severity": one of "High", "Medium", "Low", or null
- "status": one of "Open", "In Progress", "Resolved", or null
- "issueId": a specific issue id like "PN-1234" if one is mentioned, or null
- "topic": a short phrase describing what the question is about (e.g. "images", "color contrast", "buttons"), or null if the question isn't about a specific topic

IMPORTANT — when to use history vs. classify independently:
Only pull a filter or topic from history when the CURRENT message is a genuine reference to the previous turn — it uses a pronoun or vague reference ("that issue", "it", "those", "show me it") and would not make sense on its own. If the current message introduces its OWN topic or criteria, classify it entirely on its own merits and ignore unrelated filters from earlier turns, even if the conversation is continuing. A new question is not automatically a follow-up just because it comes later in the same conversation.

Examples:
"how many high issues are left" -> {"intent":"count","severity":"High","status":null,"issueId":null,"topic":null}
"what's still in progress" -> {"intent":"search","severity":null,"status":"In Progress","issueId":null,"topic":null}
"tell me about pn-1003" -> {"intent":"search","severity":null,"status":null,"issueId":"PN-1003","topic":null}
"how many issues about images are there" -> {"intent":"count","severity":null,"status":null,"issueId":null,"topic":"images"}
"hi" -> {"intent":"search","severity":null,"status":null,"issueId":null,"topic":null}

History example (genuine reference, carry the filter over):
user: how many low severity issues are there?
assistant: There is 1 issue matching Low in the knowledge base.
Current message: "show me that issue" -> {"intent":"search","severity":"Low","status":null,"issueId":null,"topic":null}

History example (NOT a reference — a new, independent question; do NOT carry the old filter over):
user: how many high severity issues are there?
assistant: There are 33 issues matching High in the knowledge base.
Current message: "how many issues about images are there" -> {"intent":"count","severity":null,"status":null,"issueId":null,"topic":"images"}`;

function buildUserContent(message, history) {
  if (!history || history.length === 0) {
    return message;
  }

  const recentHistory = history
    .slice(-6)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");

  return `CONVERSATION HISTORY:\n${recentHistory}\n\nCURRENT MESSAGE:\n${message}`;
}

function normalizeTopic(topic) {
  if (typeof topic !== "string") {
    return null;
  }

  const trimmed = topic.trim().slice(0, 200);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeExtracted(parsed) {
  if (!parsed || (parsed.intent !== "count" && parsed.intent !== "search")) {
    return FALLBACK_INTENT;
  }

  return {
    intent: parsed.intent,
    severity: VALID_SEVERITIES.includes(parsed.severity)
      ? parsed.severity
      : null,
    status: VALID_STATUSES.includes(parsed.status) ? parsed.status : null,
    issueId: typeof parsed.issueId === "string" ? parsed.issueId : null,
    topic: normalizeTopic(parsed.topic),
  };
}

async function extractIntent(message, history = []) {
  try {
    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserContent(message, history) },
          ],
          temperature: 0,
          max_tokens: 600,
        }),
      }
    );

    if (!response.ok) {
      return FALLBACK_INTENT;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return FALLBACK_INTENT;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return FALLBACK_INTENT;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return normalizeExtracted(parsed);
  } catch {
    return FALLBACK_INTENT;
  }
}

module.exports = {
  extractIntent,
  normalizeExtracted,
  buildUserContent,
  FALLBACK_INTENT,
};
