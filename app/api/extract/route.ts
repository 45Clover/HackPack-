// Owner: AI (@tomi-alo). POST /api/extract: n8n calls this after /api/ingest.
// One request = ONE Gemini call on up to 20 unread jobs (Calgary first, newest first).
// Returns { extracted, remaining }. Call it again while remaining > 0 (and quota is left).
import { sql } from "@/lib/db";
import { extractSkillsBatch, MAX_BATCH } from "@/lib/extract";
import { canonicalSkill } from "@/lib/skills";

export const maxDuration = 60; // seconds; one Gemini call on 20 jobs takes ~10-30 s

type Todo = { id: string; title: string; description: string; posted_at: Date };

export async function POST(request: Request) {
  // Only n8n (and us) know this secret. Without it, anyone could burn our Gemini quota.
  const secret = process.env.INGEST_SECRET;
  if (!secret || request.headers.get("x-ingest-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  // 1. Pick the next unread jobs. Calgary first (our story + Benevity's local prize), then newest.
  const todo = await sql<Todo[]>`
    select id, title, description, posted_at from jobs
    where not extracted
    order by (city = 'Calgary') desc nulls last, posted_at desc
    limit ${MAX_BATCH}`;
  if (todo.length === 0) return Response.json({ extracted: 0, remaining: 0 });

  // 2. ONE Gemini call for the whole batch.
  let results;
  try {
    results = await extractSkillsBatch(todo.map(({ id, title, description }) => ({ id, title, description })));
  } catch (err) {
    console.error("extract: Gemini failed", err);
    // 502 = "the service behind me failed". Nothing was saved, so the same jobs get retried next time.
    return Response.json({ error: String(err) }, { status: 502 });
  }

  // 3. Save each job's skills. One transaction per job: all of its rows are saved, or none are.
  const postedAt = new Map(todo.map((j) => [j.id, j.posted_at]));
  let extracted = 0;
  for (const job of results) {
    await sql.begin(async (tx) => {
      for (const raw of job.skills) {
        const skill = canonicalSkill(raw.name); // "ReactJS" → { slug: "react", name: "React" }
        if (!skill) continue;
        // Insert the skill, or reuse it if the slug already exists. Keep the first category it got.
        const [row] = await tx<{ id: number }[]>`
          insert into skills (slug, name, category) values (${skill.slug}, ${skill.name}, ${raw.category})
          on conflict (slug) do update set category = coalesce(skills.category, excluded.category)
          returning id`;
        await tx`
          insert into job_skills (job_id, skill_id, posted_at, required)
          values (${job.id}, ${row.id}, ${postedAt.get(job.id)!}, ${raw.required})
          on conflict do nothing`;
      }
      await tx`update jobs set extracted = true, seniority = ${job.seniority} where id = ${job.id}`;
    });
    extracted++;
  }
  // A job Gemini skipped is NOT marked extracted, so a later call picks it up again.

  const [{ remaining }] = await sql<{ remaining: number }[]>`
    select count(*)::int as remaining from jobs where not extracted`;
  return Response.json({ extracted, remaining });
}
