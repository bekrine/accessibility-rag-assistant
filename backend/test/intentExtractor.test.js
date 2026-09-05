const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractIntent,
  normalizeExtracted,
  FALLBACK_INTENT,
} = require("../src/services/intentExtractor");

function mockChatCompletion(t, content) {
  t.mock.method(global, "fetch", async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  }));
}

test("parses a valid intent JSON response", async (t) => {
  mockChatCompletion(
    t,
    '{"intent":"count","severity":"High","status":null,"issueId":null}'
  );

  const result = await extractIntent("how many high issues are left");

  assert.deepEqual(result, {
    intent: "count",
    severity: "High",
    status: null,
    issueId: null,
  });
});

test("extracts JSON even if the model wraps it in extra text", async (t) => {
  mockChatCompletion(
    t,
    'Sure, here you go:\n{"intent":"search","severity":null,"status":"Open","issueId":null}\nHope that helps!'
  );

  const result = await extractIntent("what's still open");

  assert.equal(result.intent, "search");
  assert.equal(result.status, "Open");
});

test("falls back to default on malformed JSON", async (t) => {
  mockChatCompletion(t, "not valid json at all");

  const result = await extractIntent("hello");

  assert.deepEqual(result, FALLBACK_INTENT);
});

test("falls back to default when intent field is missing or invalid", () => {
  assert.deepEqual(normalizeExtracted({ severity: "High" }), FALLBACK_INTENT);
  assert.deepEqual(
    normalizeExtracted({ intent: "unknown-thing" }),
    FALLBACK_INTENT
  );
});

test("nulls out invalid severity/status values instead of trusting them blindly", () => {
  const result = normalizeExtracted({
    intent: "search",
    severity: "Critical",
    status: "Closed",
    issueId: "PN-1",
  });

  assert.equal(result.severity, null);
  assert.equal(result.status, null);
  assert.equal(result.issueId, "PN-1");
});

test("falls back to default when the HTTP call itself fails", async (t) => {
  t.mock.method(global, "fetch", async () => ({ ok: false }));

  const result = await extractIntent("anything");

  assert.deepEqual(result, FALLBACK_INTENT);
});
