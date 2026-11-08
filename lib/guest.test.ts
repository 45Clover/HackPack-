import { test } from "node:test";
import assert from "node:assert/strict";
import { answersFromBody, parseGuest } from "./guest";

const ok = { skillIds: [15, 30, 28], role: "frontend", city: "Calgary" };

test("reads back what we wrote", () => {
  assert.deepEqual(parseGuest(JSON.stringify(ok)), ok);
  assert.deepEqual(parseGuest(JSON.stringify({ ...ok, city: null })), { ...ok, city: null });
});

test("anything invalid counts as no cookie", () => {
  for (const bad of [
    undefined, "", "not json", "null", "[]", "42",
    JSON.stringify({ ...ok, skillIds: [1.5] }),
    JSON.stringify({ ...ok, skillIds: ["15"] }),
    JSON.stringify({ ...ok, skillIds: "15" }),
    JSON.stringify({ ...ok, skillIds: Array.from({ length: 201 }, (_, i) => i) }),
    JSON.stringify({ ...ok, role: "astronaut" }),
    JSON.stringify({ ...ok, role: undefined }),
    JSON.stringify({ ...ok, city: "x".repeat(61) }),
    JSON.stringify({ ...ok, city: 7 }),
  ]) assert.equal(parseGuest(bad), null, String(bad));
});

test("the POST body is cleaned the same way", () => {
  assert.deepEqual(answersFromBody({ skillIds: [1, 1, 2], targetRole: "ml", city: "  Toronto " }), { skillIds: [1, 2], role: "ml", city: "Toronto" });
  assert.deepEqual(answersFromBody({ skillIds: [], targetRole: "nope", city: "" }), { skillIds: [], role: "any", city: null });
  assert.equal(answersFromBody({ skillIds: [1.2] }), null);
  assert.equal(answersFromBody(null), null);
});
