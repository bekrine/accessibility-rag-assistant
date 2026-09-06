const VALID_SEVERITIES = ["High", "Medium", "Low"];
const VALID_STATUSES = ["Open", "In Progress", "Resolved"];

const FALLBACK_INTENT = {
  intent: "search",
  severity: null,
  status: null,
  issueId: null,
};

const SYSTEM_PROMPT = `You are an intent classifier for an accessibility issue tracker chatbot.

You will be given the recent conversation history (if any) and the user's current message. Use the history to resolve references like "that issue", "it", "the previous one", or an implied filter carried over from an earlier turn (e.g. if the assistant just answered about Low severity issues and the user says "show me it", severity is "Low").

Reply with ONLY a JSON object (no other text, no markdown fences) describing the CURRENT message, with these fields:
- "intent": either "count" (the user wants a total/number of issues) or "search" (the user wants to know about, discuss, or be shown specific issues)
- "severity": one of "High", "Medium", "Low", or null if no severity is mentioned or implied (by this message or resolved from history)
- "status": one of "Open", "In Progress", "Resolved", or null if no status is mentioned or implied
- "issueId": a specific issue id like "PN-1234" if one is mentioned, or null

Examples:
"how many high issues are left" -> {"intent":"count","severity":"High","status":null,"issueId":null}
"what's still in progress" -> {"intent":"search","severity":null,"status":"In Progress","issueId":null}
"tell me about pn-1003" -> {"intent":"search","severity":null,"status":null,"issueId":"PN-1003"}
"hi" -> {"intent":"search","severity":null,"status":null,"issueId":null}

History example:
user: how many low severity issues are there?
assistant: There is 1 issue matching Low in the knowledge base.
Current message: "show me that issue" -> {"intent":"search","severity":"Low","status":null,"issueId":null}`;

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
