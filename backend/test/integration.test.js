const test = require("node:test");
const assert = require("node:assert/strict");

// These tests exercise the live stack (docker compose up) rather than an
// in-process app, since the app wires up Postgres/Redis/rag-service on load.
// Run `docker compose up -d` before `npm test`.

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const RAG_URL = process.env.RAG_URL || "http://localhost:8000";

test("GET /api/health returns 200", async () => {
  const response = await fetch(`${BASE_URL}/api/health`);

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(typeof body.message, "string");
});

test("GET /api/issues returns an array", async () => {
  const response = await fetch(`${BASE_URL}/api/issues`);

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(Array.isArray(body), true);
});

test("PUT /api/issues/:id without an internal key is rejected", async () => {
  const response = await fetch(`${BASE_URL}/api/issues/PN-1001`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "should not apply" }),
  });

  assert.equal(response.status, 401);
});

test("POST /api/chat rejects an empty message", async () => {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "" }),
  });

  assert.equal(response.status, 400);
});

test("rag-service GET /health returns 200", async () => {
  const response = await fetch(`${RAG_URL}/health`);

  assert.equal(response.status, 200);
});

test("rag-service POST /sync/issue without an internal key is rejected", async () => {
  const response = await fetch(`${RAG_URL}/sync/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "TEST-0",
      title: "t",
      wcag: "w",
      severity: "Low",
      status: "Open",
      page: "p",
      url: "/u",
      description: "d",
      remediation: "r",
    }),
  });

  assert.equal(response.status, 401);
});
