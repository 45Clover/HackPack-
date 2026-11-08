import { test } from "node:test";
import assert from "node:assert/strict";
import { matchProjects } from "./extras";

const p = (title: string) => ({ title, summary: "Helps someone.", uses: ["React"] });

test("keeps only slugs we asked about, once each", () => {
  const out = matchProjects(["react", "aws"], {
    skills: [
      { slug: "react", projects: [p("A")] },
      { slug: "react", projects: [p("B")] }, // duplicate: ignored
      { slug: "cobol", projects: [p("C")] }, // never asked: ignored
    ],
  });
  assert.deepEqual([...out.keys()], ["react"]);
  assert.equal(out.get("react")![0].title, "A");
});

test("max 3 projects, and drops ones with no title or summary", () => {
  const out = matchProjects(["react"], {
    skills: [{ slug: "react", projects: [p("A"), { title: " ", summary: "x", uses: [] }, p("B"), p("C"), p("D")] }],
  });
  assert.deepEqual(out.get("react")!.map((x) => x.title), ["A", "B", "C"]);
});

test("a skill with no valid projects is left out", () => {
  assert.equal(matchProjects(["react"], { skills: [{ slug: "react", projects: [] }] }).size, 0);
  assert.equal(matchProjects(["react"], {}).size, 0);
});
