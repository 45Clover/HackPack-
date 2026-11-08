// Owner: AI (@tomi-alo). POST /api/extract: n8n calls this after /api/ingest.
// One request = ONE Gemini call on up to 20 unread jobs (Calgary first, newest first).
// Returns { extracted, copied, remaining }. Call it again while remaining > 0 (and quota is left).
// copied = unread jobs with the exact same text as a job Gemini already read: they get its skills, no Gemini call.
//
// Optional ?batch=N (1-20, default 20) = how many jobs go into that one call.
// - Laptop catch-ups: no ?batch → 20 jobs (no time limit on a laptop).
// - n8n on Vercel: ?batch=8 → stays under Vercel's 60 s limit even when Gemini is slow.
import { sql } from "@/lib/db";
import { batchSize, extractSkillsBatch } from "@/lib/extract";
import { canonicalSkill } from "@/lib/skills";

export const maxDuration = 60; // seconds (Vercel's limit). 20 jobs took 36 s normally, up to 225 s when Gemini was overloaded

type Todo = { id: string; title: string; description: string; posted_at: Date };

export async function POST(request: Request) {
  // Only n8n (and us) know this secret. Without it, anyone could burn our Gemini quota.
  const secret = process.env.INGEST_SECRET;
  if (!secret || request.headers.get("x-ingest-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  // 0. Unread jobs whose exact text Gemini already read (reposts, one post per city) get its skills for free.
  let copied = await copyFromTwins();

  // 1. Pick the next unread jobs, ONE per description, so a batch never spends two slots on the same text.
  //    Calgary first (our story + Benevity's local prize), then newest.
  const todo = await sql<Todo[]>`
    select id, title, description, posted_at from (
      select distinct on (text_key) id, title, description, posted_at, city
      from (
        -- same text → same key (short texts keep their own id, so they're never merged)
        select *, case when length(description) >= ${MIN_TWIN_LENGTH} then md5(description) else id end as text_key
        from jobs where not extracted
      ) unread
      order by text_key, (city = 'Calgary') desc nulls last, posted_at desc
    ) one_per_text
    order by (city = 'Calgary') desc nulls last, posted_at desc
    limit ${batchSize(request.url)}`;
  if (todo.length === 0) return Response.json({ extracted: 0, copied, remaining: 0 });

  // 2. ONE Gemini call for the whole batch.
  let results;
  try {
    // On Vercel (it sets VERCEL=1): each model gets up to 25 s, and all models together get 55 s,
    // leaving ~5 s to save to Neon before Vercel's 60 s limit. On a laptop: no limits at all.
    const limits = process.env.VERCEL ? { timeoutMs: 25_000, totalMs: 55_000 } : {};
    results = await extractSkillsBatch(todo.map(({ id, title, description }) => ({ id, title, description })), limits);
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
      // Gemini's answer REPLACES any earlier skills for this job (e.g. the seed script's
      // keyword guesses). Inside the transaction, so a failure undoes this delete too.
      await tx`delete from job_skills where job_id = ${job.id}`;
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

  // 4. The jobs just read are now twins too: copy their skills to any identical unread jobs.
  copied += await copyFromTwins();

  const [{ remaining }] = await sql<{ remaining: number }[]>`
    select count(*)::int as remaining from jobs where not extracted`;
  return Response.json({ extracted, copied, remaining });
}

// Shorter texts (empty or "see website") could match across unrelated jobs, so they are never treated as twins.
const MIN_TWIN_LENGTH = 200;

// Gives every unread job the skills + seniority of an extracted job with the SAME description, no Gemini call.
// One transaction: a job is marked extracted only together with its copied skills. Returns how many jobs it filled.
async function copyFromTwins(): Promise<number> {
  return sql.begin(async (tx) => {
    const pairs = await tx<{ uid: string; tid: string }[]>`
      select distinct on (u.id) u.id as uid, t.id as tid
      from jobs u
      join jobs t on md5(t.description) = md5(u.description) and t.id <> u.id and t.extracted
      where not u.extracted and length(u.description) >= ${MIN_TWIN_LENGTH}
      order by u.id, t.id`;
    if (pairs.length === 0) return 0;
    const uids = pairs.map((p) => p.uid); // postgres.js sends a JS array as a Postgres array
    const tids = pairs.map((p) => p.tid);

    // Same as a Gemini save: the copy REPLACES earlier skills (e.g. the seed script's keyword guesses).
    await tx`delete from job_skills where job_id = any(${uids}::text[])`;
    await tx`
      insert into job_skills (job_id, skill_id, posted_at, required)
      select u.id, s.skill_id, u.posted_at, s.required          -- the job's OWN posted_at, not its twin's
      from unnest(${uids}::text[], ${tids}::text[]) as p(uid, tid)
      join jobs u on u.id = p.uid
      join job_skills s on s.job_id = p.tid
      on conflict do nothing`;
    await tx`
      update jobs u set extracted = true, seniority = t.seniority
      from unnest(${uids}::text[], ${tids}::text[]) as p(uid, tid)
      join jobs t on t.id = p.tid
      where u.id = p.uid`;
    return pairs.length;
  });
}
