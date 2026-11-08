import { test } from "node:test";
import assert from "node:assert/strict";
import { isBot, parseWaitlist } from "./waitlist";

const ok = { email: "ada@example.com", role: "student", internships: true, source: "waitlist" };

test("a good body comes back clean", () => {
  assert.deepEqual(parseWaitlist(ok), ok);
  assert.deepEqual(parseWaitlist({ email: "ada@example.com", role: "employer" }), { email: "ada@example.com", role: "employer", internships: false, source: "landing" });
  assert.equal(parseWaitlist({ ...ok, source: "somewhere" })?.source, "landing");
  assert.equal(parseWaitlist({ ...ok, source: "joinearly" })?.source, "joinearly");
});

test("email is trimmed and lowercased", () => {
  assert.equal(parseWaitlist({ ...ok, email: "  Ada.Lovelace@Example.COM " })?.email, "ada.lovelace@example.com");
});

test("bad emails are rejected", () => {
  for (const email of [undefined, "", "ada", "ada@example", "ada @example.com", "@example.com", "ada@.com", 42, `${"a".repeat(250)}@example.com`])
    assert.equal(parseWaitlist({ ...ok, email }), null, String(email));
});

test("bad roles are rejected", () => {
  for (const role of [undefined, "", "Student", "astronaut", 1]) assert.equal(parseWaitlist({ ...ok, role }), null, String(role));
  assert.equal(parseWaitlist(null), null);
});

test("the hidden company field marks a bot", () => {
  assert.equal(isBot({ ...ok, company: "Acme" }), true);
  assert.equal(isBot({ ...ok, company: "" }), false);
  assert.equal(isBot(ok), false);
  assert.equal(isBot(null), false);
});
