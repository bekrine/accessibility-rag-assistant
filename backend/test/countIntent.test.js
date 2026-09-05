const test = require("node:test");
const assert = require("node:assert/strict");

const { isCountQuestion, detectCountFilters } = require("../src/services/countIntent");

test("recognizes count-style questions", () => {
  assert.equal(isCountQuestion("How many high severity issues are there?"), true);
  assert.equal(isCountQuestion("What is the total number of open issues?"), true);
  assert.equal(isCountQuestion("Give me a count of resolved issues"), true);
});

test("does not treat ordinary questions as count questions", () => {
  assert.equal(isCountQuestion("What is PN-1003 about?"), false);
  assert.equal(isCountQuestion("Tell me about the color contrast issues"), false);
});

test("extracts a severity filter", () => {
  const { conditions, params } = detectCountFilters(
    "how many high severity issues are open?"
  );

  assert.deepEqual(params, ["High", "Open"]);
  assert.equal(conditions.length, 2);
});

test("returns no filters for an unfiltered count question", () => {
  const { conditions, params } = detectCountFilters("how many issues are there?");

  assert.deepEqual(conditions, []);
  assert.deepEqual(params, []);
});
