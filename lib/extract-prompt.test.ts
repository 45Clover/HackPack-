import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIES } from "./categories";
import { EXTRACT_SYSTEM_PROMPT, SENIORITY, buildExtractInput, type ExtractResult } from "./extract-prompt";

test("categories in code match the SQL migration", () => {
  const sql = readFileSync(new URL("../db/002_skill_categories.sql", import.meta.url), "utf8");
  const inSql = [...sql.matchAll(/\('([a-z-]+)',\s+'/g)].map((m) => m[1]);
  assert.deepEqual(inSql, CATEGORIES.map((c) => c.slug));
});

test("the prompt's example only uses allowed values", () => {
  const example = JSON.parse(EXTRACT_SYSTEM_PROMPT.split("Output: ")[1]) as ExtractResult;
  const slugs = CATEGORIES.map((c) => c.slug as string);
  for (const job of example.jobs) {
    assert.ok(SENIORITY.includes(job.seniority));
    for (const s of job.skills) assert.ok(slugs.includes(s.category), s.category);
  }
});

test("input is trimmed JSON with only id, title, description", () => {
  const input = JSON.parse(buildExtractInput([{ id: "x", title: "Dev", description: "a".repeat(20_000) }]));
  assert.deepEqual(Object.keys(input[0]), ["id", "title", "description"]);
  assert.equal(input[0].description.length, 12000);
});
