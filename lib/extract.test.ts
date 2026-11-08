import { test } from "node:test";
import assert from "node:assert/strict";
import { attemptTimeout, batchSize, cleanResults, shouldTryNextModel } from "./extract";

const jobs = [
  { id: "a", title: "Dev", description: "" },
  { id: "b", title: "Dev", description: "" },
];

test("keeps only ids we sent, once each", () => {
  const out = cleanResults(jobs, {
    jobs: [
      { id: "a", seniority: "junior", skills: [] },
      { id: "a", seniority: "senior", skills: [] }, // duplicate: ignored
      { id: "zzz", seniority: "mid", skills: [] },  // never sent: ignored
    ],
  });
  assert.deepEqual(out.map((j) => j.id), ["a"]); // "b" missing → stays unextracted
  assert.equal(out[0].seniority, "junior");
});

test("drops skills with bad categories, empty names or duplicates", () => {
  const out = cleanResults(jobs, {
    jobs: [{
      id: "b", seniority: "mid",
      skills: [
        { name: " React ", category: "frontend", required: true },
        { name: "react", category: "frontend", required: false }, // duplicate
        { name: "Docker", category: "framework" as never, required: true }, // old category
        { name: "  ", category: "backend", required: true },
      ],
    }],
  });
  assert.deepEqual(out[0].skills, [{ name: "React", category: "frontend", required: true }]);
});

test("unknown seniority becomes 'unknown'", () => {
  const out = cleanResults(jobs, { jobs: [{ id: "a", seniority: "wizard" as never, skills: [] }] });
  assert.equal(out[0].seniority, "unknown");
});

test("empty or missing output gives no results", () => {
  assert.deepEqual(cleanResults(jobs, {}), []);
});

test("?batch= picks the batch size, anything odd falls back to 20", () => {
  const u = (q: string) => `http://localhost:3000/api/extract${q}`;
  assert.equal(batchSize(u("")), 20);
  assert.equal(batchSize(u("?batch=8")), 8);
  assert.equal(batchSize(u("?batch=0")), 20);
  assert.equal(batchSize(u("?batch=500")), 20);
  assert.equal(batchSize(u("?batch=abc")), 20);
  assert.equal(batchSize(u("?batch=2.5")), 20);
});

test("falls back to the next model on quota, overload or timeout, not on real errors", () => {
  assert.equal(shouldTryNextModel({ status: 429 }), true);
  assert.equal(shouldTryNextModel({ status: 503 }), true);
  assert.equal(shouldTryNextModel({ name: "AbortError", message: "This operation was aborted" }), true);
  assert.equal(shouldTryNextModel(new Error("Request timed out after 25000ms")), true);
  assert.equal(shouldTryNextModel({ status: 400, message: "bad request" }), false);
  assert.equal(shouldTryNextModel({ status: 403, message: "API key invalid" }), false);
});

test("falls back when Google's deadline expires (504), as seen live on Vercel", () => {
  assert.equal(shouldTryNextModel({ status: 504 }), true);
  assert.equal(shouldTryNextModel(new Error('{"error":{"code":504,"message":"Deadline expired before operation could complete.","status":"DEADLINE_EXCEEDED"}}')), true);
});

test("each model gets up to 25 s, but never more than what's left of the 55 s total", () => {
  const vercel = { timeoutMs: 25_000, totalMs: 55_000 };
  assert.equal(attemptTimeout(0, 0, vercel), 25_000);       // first model: full 25 s
  assert.equal(attemptTimeout(0, 1_000, vercel), 25_000);   // previous model failed fast: still 25 s
  assert.equal(attemptTimeout(0, 40_000, vercel), 15_000);  // previous models were slow: only 15 s left
  assert.equal(attemptTimeout(0, 52_000, vercel), null);    // under 5 s left: don't start another model
  assert.equal(attemptTimeout(0, 999_999, {}), undefined);  // laptop: no limit
});
