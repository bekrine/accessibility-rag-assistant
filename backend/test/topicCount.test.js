const test = require("node:test");
const assert = require("node:assert/strict");

const { answerTopicCountQuestion } = require("../src/services/topicCount");

function mockCountResponse(t, body) {
  t.mock.method(global, "fetch", async () => ({
    ok: true,
    json: async () => body,
  }));
}

test("formats a plain topic count with no filters", async (t) => {
  mockCountResponse(t, { count: 3, sources: [] });

  const result = await answerTopicCountQuestion({
    topic: "images",
    severity: null,
    status: null,
    issueId: null,
  });

  assert.equal(result.answer, 'There are 3 issues related to "images".');
  assert.deepEqual(result.sources, []);
});

test("uses singular phrasing for a count of 1", async (t) => {
  mockCountResponse(t, { count: 1, sources: [] });

  const result = await answerTopicCountQuestion({
    topic: "color contrast",
    severity: null,
    status: null,
    issueId: null,
  });

  assert.match(result.answer, /^There is 1 .*issue related to "color contrast"\.$/);
});

test("includes severity/status filters in the answer text", async (t) => {
  mockCountResponse(t, { count: 2, sources: [] });

  const result = await answerTopicCountQuestion({
    topic: "images",
    severity: "High",
    status: "Open",
    issueId: null,
  });

  assert.equal(
    result.answer,
    'There are 2 High Open issues related to "images".'
  );
});

test("throws when the rag-service call fails", async (t) => {
  t.mock.method(global, "fetch", async () => ({ ok: false, status: 502 }));

  await assert.rejects(() =>
    answerTopicCountQuestion({
      topic: "images",
      severity: null,
      status: null,
      issueId: null,
    })
  );
});
