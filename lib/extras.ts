// Owner: AI (@tomi-alo). The "extras" on a skill page: where to learn it (Keenable),
// how many Calgary ads mention it (Adzuna), and project ideas to prove it (Gemini).
//
// Two rules keep this fast and cheap:
// 1. getExtras (runs on every skill page view) NEVER calls Gemini. A few page views
//    would otherwise burn the 20 calls/day we need for reading jobs.
// 2. Results are saved in the skill_extras table (a cache), so each outside API
//    is asked once per skill, not once per visit.
import { sql } from "./db";
import { callGemini } from "./extract";

export type Project = { title: string; summary: string; uses: string[] };
export type Extras = {
  resources: { title: string; url: string }[];
  projects: Project[];
  adzuna_count: number | null;
};

const TIMEOUT_MS = 5000; // a slow outside API must not hang the page

// ---------- On page view: read the cache, fill it the first time ----------

export async function getExtras(skill: { id: number; name: string }): Promise<Extras> {
  const [cached] = await sql<Extras[]>`
    select resources, projects, adzuna_count from skill_extras where skill_id = ${skill.id}`;
  if (cached && cached.resources.length > 0) return cached;

  // allSettled, not all: if Adzuna fails, we still show Keenable's links (and the other way round).
  const [links, count] = await Promise.allSettled([learningLinks(skill.name), calgaryAdCount(skill.name)]);
  const resources = links.status === "fulfilled" ? links.value : [];
  const adzuna_count = count.status === "fulfilled" ? count.value : null;

  // Only cache a good result, so a failed fetch gets retried on the next visit.
  if (resources.length > 0) {
    await sql`
      insert into skill_extras (skill_id, resources, adzuna_count)
      values (${skill.id}, ${sql.json(resources)}, ${adzuna_count})
      on conflict (skill_id) do update
        set resources = excluded.resources, adzuna_count = excluded.adzuna_count, updated_at = now()`;
  }
  return { resources, adzuna_count, projects: cached?.projects ?? [] };
}

// Keenable search: real, live links, so the AI never has to invent a URL.
async function learningLinks(name: string): Promise<Extras["resources"]> {
  const res = await fetch("https://api.keenable.ai/v1/search/public", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Keenable-Title": "HackPack" },
    body: JSON.stringify({ query: `learn ${name} official documentation beginner tutorial`, max_results: 5 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`keenable ${res.status}`);
  const data = (await res.json()) as { results?: { title: string; url: string }[] };
  return (data.results ?? []).map((r) => ({ title: r.title, url: r.url }));
}

// Adzuna: how many Calgary job ads mention this skill right now. Null if keys are missing.
async function calgaryAdCount(name: string): Promise<number | null> {
  const { ADZUNA_APP_ID: id, ADZUNA_APP_KEY: key } = process.env;
  if (!id || !key) return null;
  const q = new URLSearchParams({ app_id: id, app_key: key, what: name, where: "Calgary", results_per_page: "1" });
  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/ca/search/1?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`adzuna ${res.status}`);
  return ((await res.json()) as { count?: number }).count ?? null;
}

// ---------- Run once by hand (POST /api/extras): project ideas for the top skills ----------

type SkillContext = { slug: string; name: string; pairs: string[]; titles: string[] };

const PROJECTS_PROMPT = `You suggest portfolio projects for students who want to get hired in Canadian tech.
INPUT: a JSON array of skills. Each has "slug", "name", "pairs" (skills employers ask for together with it, from real job posts) and "titles" (real job titles that ask for it).
For EACH skill, suggest 3 projects a student could finish in 2 to 4 weekends to prove that skill to employers.
- Each project solves a real problem a real user has, not a tutorial clone (no todo apps, no weather apps).
- Each project uses the skill plus 1 to 3 of its "pairs".
- "summary": 1 to 2 plain sentences: what it does and who it's for.
- "uses": the skills it uses, names taken from the skill and its pairs.
Return every input slug exactly once.`;

const PROJECTS_SCHEMA = {
  type: "object",
  properties: {
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slug: { type: "string" },
          projects: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              properties: { title: { type: "string" }, summary: { type: "string" }, uses: { type: "array", items: { type: "string" } } },
              required: ["title", "summary", "uses"],
            },
          },
        },
        required: ["slug", "projects"],
      },
    },
  },
  required: ["skills"],
};

// ONE Gemini call for the top `limit` skills (by number of job posts). Returns how many skills got ideas.
export async function generateProjectIdeas(limit = 15): Promise<number> {
  const top = await sql<{ id: number; slug: string; name: string }[]>`
    select s.id, s.slug, s.name from job_skills js join skills s on s.id = js.skill_id
    group by s.id order by count(*) desc limit ${limit}`;
  if (top.length === 0) return 0;

  // Real context for each skill, so the ideas match what employers actually ask for.
  const context: SkillContext[] = [];
  for (const s of top) {
    const pairs = await sql<{ name: string }[]>`
      select o.name from job_skills a
      join job_skills b on b.job_id = a.job_id and b.skill_id <> a.skill_id
      join skills o on o.id = b.skill_id
      where a.skill_id = ${s.id} group by o.name order by count(*) desc limit 6`;
    const titles = await sql<{ title: string }[]>`
      select distinct j.title from job_skills js join jobs j on j.id = js.job_id
      where js.skill_id = ${s.id} limit 5`;
    context.push({ slug: s.slug, name: s.name, pairs: pairs.map((p) => p.name), titles: titles.map((t) => t.title) });
  }

  const text = await callGemini(JSON.stringify(context), PROJECTS_PROMPT, PROJECTS_SCHEMA);
  const bySlug = matchProjects(top.map((s) => s.slug), JSON.parse(text));

  const idBySlug = new Map(top.map((s) => [s.slug, s.id]));
  for (const [slug, projects] of bySlug) {
    await sql`
      insert into skill_extras (skill_id, projects) values (${idBySlug.get(slug)!}, ${sql.json(projects)})
      on conflict (skill_id) do update set projects = excluded.projects, updated_at = now()`;
  }
  return bySlug.size;
}

// Same idea as cleanResults in extract.ts: keep only slugs we asked about, once each,
// at most 3 projects, and only projects with a title and summary. Exported for the test.
export function matchProjects(askedSlugs: string[], parsed: { skills?: { slug: string; projects?: Project[] }[] }) {
  const asked = new Set(askedSlugs);
  const out = new Map<string, Project[]>();
  for (const s of parsed.skills ?? []) {
    if (!asked.has(s.slug) || out.has(s.slug)) continue;
    const projects = (s.projects ?? [])
      .filter((p) => p.title?.trim() && p.summary?.trim())
      .slice(0, 3)
      .map((p) => ({ title: p.title.trim(), summary: p.summary.trim(), uses: Array.isArray(p.uses) ? p.uses : [] }));
    if (projects.length > 0) out.set(s.slug, projects);
  }
  return out;
}
