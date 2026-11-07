import { test } from "node:test";
import assert from "node:assert/strict";
import { matchSkills } from "./resume";

const names = (xs: { name: string }[]) => xs.map((x) => x.name).sort();
const skills = ["React", "Node.js", "C", "C++", "Go", "Java", "JavaScript", "AWS", "PostgreSQL", "CI/CD"].map((name) => ({ name }));

test("finds whole skills, not pieces of other words", () => {
  const text = "Built REST APIs in node.js and React. Some C++ and Go services on aws. Deployed with CI/CD. JavaScript daily.";
  assert.deepEqual(names(matchSkills(text, skills)), ["C++", "CI/CD", "Go", "JavaScript", "Node.js", "React"].sort());
});

test("short names need exact case", () => {
  assert.deepEqual(names(matchSkills("I like to go hiking", skills)), []);
  assert.deepEqual(names(matchSkills("Java and Javascript", skills)), ["Java", "JavaScript"]);
});
