const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractIntent,
  normalizeExtracted,
  buildUserContent,
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
    '{"intent":"count","severity":"High","status":null,"issueId":null,"topic":null,"scope":null}'
  );

  const result = await extractIntent("how many high issues are left");

  assert.deepEqual(result, {
    intent: "count",
    severity: "High",
    status: null,
    issueId: null,
    topic: null,
    scope: null,
  });
});

test("extracts JSON even if the model wraps it in extra text", async (t) => {
  mockChatCompletion(
    t,
    'Sure, here you go:\n{"intent":"search","severity":null,"status":"Open","issueId":null,"topic":null}\nHope that helps!'
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

test("buildUserContent passes the message through unchanged with no history", () => {
  assert.equal(buildUserContent("hello", []), "hello");
  assert.equal(buildUserContent("hello", undefined), "hello");
});

test("buildUserContent includes recent history for reference resolution", () => {
  const history = [
    { role: "user", content: "how many low issues are there?" },
    { role: "assistant", content: "There is 1 issue matching Low." },
  ];

  const content = buildUserContent("show me that issue", history);

  assert.match(content, /CONVERSATION HISTORY:/);
  assert.match(content, /user: how many low issues are there\?/);
  assert.match(content, /CURRENT MESSAGE:\nshow me that issue/);
});

test("resolves a filter carried over from the previous turn", async (t) => {
  mockChatCompletion(
    t,
    '{"intent":"search","severity":"Low","status":null,"issueId":null,"topic":null}'
  );

  const history = [
    { role: "user", content: "how many low issues are there?" },
    { role: "assistant", content: "There is 1 issue matching Low." },
  ];

  const result = await extractIntent("show me that issue", history);

  assert.equal(result.severity, "Low");
});

test("extracts a topic for a topical question", async (t) => {
  mockChatCompletion(
    t,
    '{"intent":"count","severity":null,"status":null,"issueId":null,"topic":"images"}'
  );

  const result = await extractIntent("how many issues about images are there");

  assert.equal(result.intent, "count");
  assert.equal(result.topic, "images");
  assert.equal(result.severity, null);
});

test("extracts scope for a reference to a just-found result set", async (t) => {
  mockChatCompletion(
    t,
    '{"intent":"count","severity":"High","status":null,"issueId":null,"topic":null,"scope":"last_results"}'
  );

  const history = [
    { role: "user", content: "[scanned a website]" },
    {
      role: "assistant",
      content: "Scanned https://example.com and found 2 accessibility issues.",
    },
  ];

  const result = await extractIntent("how many of them are high", history);

  assert.equal(result.scope, "last_results");
  assert.equal(result.severity, "High");
});

test("normalizeExtracted only accepts 'last_results' as a valid scope", () => {
  assert.equal(
    normalizeExtracted({ intent: "search", scope: "last_results" }).scope,
    "last_results"
  );
  assert.equal(
    normalizeExtracted({ intent: "search", scope: "everything" }).scope,
    null
  );
  assert.equal(
    normalizeExtracted({ intent: "search" }).scope,
    null
  );
});

test("normalizeExtracted trims topic and nulls out an empty string", () => {
  assert.equal(
    normalizeExtracted({ intent: "search", topic: "  images  " }).topic,
    "images"
  );
  assert.equal(
    normalizeExtracted({ intent: "search", topic: "" }).topic,
    null
  );
  assert.equal(
    normalizeExtracted({ intent: "search", topic: 42 }).topic,
    null
  );
});

// This documents the intended behavior for the regression this test suite
// caught live: a fresh, unrelated question later in the same conversation
// should NOT inherit a filter from an earlier, unrelated turn. The model's
// actual judgment call can only be verified against the live API (see the
// manual verification steps run alongside this change), but this pins down
// that normalizeExtracted correctly reflects whatever the model decides
// on a case where it should classify independently of a prior filter.
test("an unrelated new topic is not forced to inherit a prior filter", async (t) => {
  mockChatCompletion(
    t,
    '{"intent":"count","severity":null,"status":null,"issueId":null,"topic":"images"}'
  );

  const history = [
    { role: "user", content: "how many high severity issues are there?" },
    { role: "assistant", content: "There are 33 issues matching High." },
  ];

  const result = await extractIntent(
    "how many issues about images are there",
    history
  );

  assert.equal(result.severity, null);
  assert.equal(result.topic, "images");
});
