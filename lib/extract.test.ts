import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanResults } from "./extract";

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
