import { test } from "node:test";
import assert from "node:assert/strict";
import { pairSkills, parseImpactAnswer, type SnapshotSet } from "./impact/prompt";
import { DATASETS } from "./impact/datasets";

const set = (id: string, fits: SnapshotSet["fits"], series = [{ period: "2022 Q3", value: 1700 }, { period: "2026 Q2", value: 1890 }]): SnapshotSet =>
  ({ id, source: "statcan", vectorId: 1, title: `Average asking rent for a 2-bedroom apartment, Calgary (${id})`, url: "https://example.org", unit: "$", sdg: "11", fits, series });
const rent = set("rent", ["frontend"]);
const react = { id: 1, slug: "react", name: "React", category: "frontend" };
const pairs = [{ skill: react, dataset: rent }];
const ok = {
  skill_slug: "react", dataset_id: "rent",
  problem: "A 2-bedroom in Calgary went from $1,700 in 2022 Q3 to $1,890 in 2026 Q2.",
  build: "A rent map for renters, with 3 filters and WCAG 2.2 colour contrast.",
  practice: "Uses React components and state.",
  proof: "A public repo and a live link.",
};
const answer = (...projects: object[]) => JSON.stringify({ projects });

test("keeps a grounded project and cleans em dashes", () => {
  const { kept, dropped } = parseImpactAnswer(pairs, answer({ ...ok, practice: "Uses React — components and state." }));
  assert.deepEqual(dropped, []);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].practice, "Uses React, components and state.");
  assert.equal(kept[0].dataset.id, "rent");
});

test("drops answers we never asked for, repeats, empty texts, and reports missing ones", () => {
  const { kept, dropped } = parseImpactAnswer(pairs, answer({ ...ok, dataset_id: "other" }, { ...ok, proof: " " }, ok));
  assert.equal(kept.length, 0);
  assert.deepEqual(dropped, ["react|other: not asked for, or a repeat", "react|rent: a text is empty", "react|rent: not asked for, or a repeat"]);
  assert.deepEqual(parseImpactAnswer(pairs, answer()).dropped, ["react|rent: missing from the answer"]);
  assert.deepEqual(parseImpactAnswer(pairs, "not json").dropped, ["the answer was not JSON"]);
});

test("drops any number that is not in the series", () => {
  const made = (patch: object) => parseImpactAnswer(pairs, answer({ ...ok, ...patch })).dropped;
  assert.deepEqual(made({ problem: "Rent rose 11% to $1,890 in 2026 Q2." }), ["react|rent: problem has 11, which is not in the series"]);
  assert.deepEqual(made({ problem: "Rent in Calgary is too high." }), ["react|rent: problem quotes no value from the series"]);
  assert.deepEqual(made({ build: "Helps the 40,000 renters in the city." }), ["react|rent: build has 40000, which is not in the series"]);
  assert.deepEqual(made({ proof: "Show that 5% more people find a home." }), ["react|rent: proof has 5%, which is not in the series"]);
});

test("allows rounded values", () => {
  const neet = set("neet", ["frontend"], [{ period: "2010", value: 13.7 }, { period: "2025", value: 13.27 }]);
  const p = [{ skill: react, dataset: neet }];
  const res = parseImpactAnswer(p, answer({ ...ok, dataset_id: "neet", problem: "Youth NEET went from 13.7% in 2010 to 13.3% in 2025." }));
  assert.deepEqual(res.dropped, []);
});

test("pairs each skill with 2 different datasets that fit, and skills in one category take turns", () => {
  const sets = [set("a", ["frontend"]), set("b", ["frontend"]), set("c", ["frontend", "backend"]), set("d", ["backend"])];
  const skills = [react, { id: 2, slug: "nextjs", name: "Next.js", category: "frontend" }, { id: 3, slug: "node", name: "Node.js", category: "backend" }];
  const ids = (slug: string) => pairSkills(skills, sets).filter((p) => p.skill.slug === slug).map((p) => p.dataset.id);
  assert.deepEqual(ids("react"), ["a", "b"]);
  assert.deepEqual(ids("nextjs"), ["c", "a"]); // its turn starts where React's ended, and wraps
  assert.deepEqual(ids("node"), ["c", "d"]);
  // no category, or one no dataset fits: still gets projects, from all datasets
  assert.equal(pairSkills([{ ...react, category: null }], sets).length, 2);
  // fewer fitting datasets than PER_SKILL: no repeats
  assert.deepEqual(pairSkills([{ ...react, category: "backend" }], [set("d", ["backend"])]).map((p) => p.dataset.id), ["d"]);
});

test("every curated dataset has a unique id, a source link and at least one category", () => {
  assert.equal(new Set(DATASETS.map((d) => d.id)).size, DATASETS.length);
  for (const d of DATASETS) {
    assert.ok(d.url.startsWith("https://"), d.id);
    assert.ok(d.fits.length > 0, d.id);
  }
});
