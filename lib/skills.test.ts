import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalSkill } from "./skills";

test("known spellings map to one skill", () => {
  assert.deepEqual(canonicalSkill(" ReactJS "), { slug: "react", name: "React" });
  assert.deepEqual(canonicalSkill("Node.js"), { slug: "nodejs", name: "Node.js" });
  assert.equal(canonicalSkill("Amazon Web Services")?.slug, "aws");
});

test("symbols keep skills apart", () => {
  assert.equal(canonicalSkill("C++")?.slug, "cplusplus");
  assert.equal(canonicalSkill("C#")?.slug, "csharp");
  assert.equal(canonicalSkill("CI/CD")?.slug, "ci-cd");
});

test("unknown skills keep their name", () => {
  assert.deepEqual(canonicalSkill("Spring Boot"), { slug: "spring-boot", name: "Spring Boot" });
});

test("empty input gives null", () => {
  assert.equal(canonicalSkill("   "), null);
  assert.equal(canonicalSkill("!!!"), null);
});

// TODO(Tomi): add a test for ".NET" and one for "Vue.js" here.
