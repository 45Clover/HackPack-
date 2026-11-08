// Writes the "Impact projects" for the top skills with Gemini and saves them to impact_projects.
// Run by hand, after scripts/impact-fetch.ts. The live site only reads the table.
//
//   set -a && source .env.local && set +a
//   npx tsx scripts/impact-generate.ts --dry-run   reads the top skills, prints the pairing and the first call's prompt. No Gemini, no writes.
//   npx tsx scripts/impact-generate.ts             the real run: one Gemini call per 5 skills, saved as it goes
//
// Numbers come only from data/impact-datasets.json. Any project with a number not in its series is dropped and listed.
import { readFileSync } from "node:fs";
import { DATASETS, type Point } from "../lib/impact/datasets";
import {
  IMPACT_SCHEMA, IMPACT_SYSTEM_PROMPT, SKILLS_PER_CALL, buildImpactInput, pairSkills, parseImpactAnswer, type Pair, type SkillRow, type SnapshotSet,
} from "../lib/impact/prompt";

const TOP = 30; // skills, by number of job posts
// shortcut: callGemini doesn't say which model answered, so this names both. Upgrade: have it return the model.
const MODEL = "gemini-flash-latest (or gemini-flash-lite-latest on quota fallback)";
const dryRun = process.argv.includes("--dry-run");

type Snapshot = { fetched_at: string; datasets: { id: string; series: Point[] }[] };

async function main() {
  const snap = JSON.parse(readFileSync(new URL("../data/impact-datasets.json", import.meta.url), "utf8")) as Snapshot;
  const datasets: SnapshotSet[] = DATASETS.flatMap((d) => {
    const s = snap.datasets.find((x) => x.id === d.id);
    if (!s) console.warn(`${d.id} is not in the snapshot. Run scripts/impact-fetch.ts.`);
    return s ? [{ ...d, series: s.series }] : [];
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Run: set -a && source .env.local && set +a");

  const { sql } = await import("../lib/db");
  try {
    const skills = await sql<SkillRow[]>`
      select s.id, s.slug, s.name, s.category from job_skills js join skills s on s.id = js.skill_id
      group by s.id order by count(*) desc, s.id limit ${TOP}`;
    const pairs = pairSkills([...skills], datasets);
    const batches: Pair[][] = [];
    for (let i = 0; i < skills.length; i += SKILLS_PER_CALL) {
      const ids = new Set(skills.slice(i, i + SKILLS_PER_CALL).map((s) => s.id));
      batches.push(pairs.filter((p) => ids.has(p.skill.id)));
    }
    console.log(`${skills.length} skills, ${pairs.length} projects, ${batches.length} Gemini calls (${SKILLS_PER_CALL} skills each). Data fetched ${snap.fetched_at}.`);

    if (dryRun) {
      for (const p of pairs) console.log(`  ${p.skill.name.padEnd(18)} ${(p.skill.category ?? "-").padEnd(13)} ${p.dataset.id.padEnd(14)} ${p.dataset.title}`);
      console.log(`\n--- system instruction ---\n${IMPACT_SYSTEM_PROMPT}\n\n--- input for call 1 of ${batches.length} ---\n${buildImpactInput(batches[0] ?? [])}`);
      console.log("\nDry run: Gemini was not called and nothing was written.");
      return;
    }

    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in .env.local.");
    const [{ t }] = await sql<{ t: string | null }[]>`select to_regclass('impact_projects')::text as t`;
    if (!t) throw new Error("The impact_projects table doesn't exist yet. Ask @fabf28 to apply db/008_impact_projects.sql in Neon.");

    const { callGemini } = await import("../lib/extract"); // throttled, falls back to the lite model on 429
    let saved = 0;
    for (const [i, batch] of batches.entries()) {
      const { kept, dropped } = parseImpactAnswer(batch, await callGemini(buildImpactInput(batch), IMPACT_SYSTEM_PROMPT, IMPACT_SCHEMA));
      for (const g of kept) {
        await sql`
          insert into impact_projects (skill_id, source, dataset_id, dataset_title, dataset_url, unit, series, problem, build, practice, proof, sdg_goal, model)
          values (${g.skill.id}, ${g.dataset.source}, ${g.dataset.id}, ${g.dataset.title}, ${g.dataset.url}, ${g.dataset.unit}, ${sql.json(g.dataset.series)},
                  ${g.problem}, ${g.build}, ${g.practice}, ${g.proof}, ${g.dataset.sdg}, ${MODEL})
          on conflict (skill_id, dataset_id) do update set
            source = excluded.source, dataset_title = excluded.dataset_title, dataset_url = excluded.dataset_url, unit = excluded.unit,
            series = excluded.series, problem = excluded.problem, build = excluded.build, practice = excluded.practice,
            proof = excluded.proof, sdg_goal = excluded.sdg_goal, model = excluded.model, created_at = now()`;
      }
      saved += kept.length;
      console.log(`Call ${i + 1}/${batches.length}: saved ${kept.length}, dropped ${dropped.length}`);
      for (const d of dropped) console.log(`  dropped ${d}`);
    }
    console.log(`\nDone: ${saved} of ${pairs.length} impact projects saved.`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
