// Owner: UI (@SaagiiSG). Everything the signed-in dashboard needs, in one place.
import { sql } from "./db";
import { inScope, type Scope } from "./scope";
import { roleBySlug } from "./roles";

export type Profile = { target_role: string | null; city: string | null };
export type MySkill = { id: number; slug: string; name: string; category: string | null };
export type GraphJob = { id: string; title: string; url: string; company: string; city: string | null; remote: boolean; posted_at: Date; have: number; needed: number };
export type GraphLink = { job_id: string; skill_id: number; slug: string; name: string; category: string | null; required: boolean; has: boolean };
// week / prev: job posts asking for it in the last 7 days vs the 7 days before (the trend arrow).
export type Leader = { slug: string; name: string; category: string | null; jobs: number; has: boolean; week: number; prev: number };
export type NextSkill = { slug: string; name: string; jobs: number } | null;

export async function getProfile(sub: string) {
  const [profile] = await sql<Profile[]>`select target_role, city from profiles where user_sub = ${sub}`;
  return profile ?? null;
}

export async function getDashboard(sub: string, scope: Scope, roleSlug: string | null) {
  const mine = await sql<MySkill[]>`
    select s.id, s.slug, s.name, s.category from user_skills us join skills s on s.id = us.skill_id
    where us.user_sub = ${sub} and us.status = 'have' order by s.name`;
  return getDashboardFor([...mine], scope, roleSlug);
}

// The dashboard for a set of skills: the signed-in user's, or /preview's sample resume.
export async function getDashboardFor(mine: MySkill[], scope: Scope, roleSlug: string | null) {
  const area = inScope(scope);
  const titles = roleBySlug(roleSlug).titles;
  const roleFilter = titles ? sql`and j.title ~* ${titles}` : sql``;
  const ids = mine.map((m) => m.id);

  const [jobs, leaders] = await Promise.all([
    // The 15 jobs you're closest to: share of their MUST-HAVE skills you already have. No skills (a guest): the newest 15.
    sql<GraphJob[]>`
      with mine as (select unnest(${ids}::int[]) as skill_id)
      select j.id, j.title, j.url, c.name as company, j.city, j.remote, j.posted_at,
             count(*) filter (where js.required and js.skill_id in (select skill_id from mine))::int as have,
             count(*) filter (where js.required)::int as needed
      from jobs j
      join companies c on c.id = j.company_id
      join job_skills js on js.job_id = j.id
      where j.posted_at > now() - interval '60 days' and ${area} ${roleFilter}
      group by j.id, c.name
      ${ids.length ? sql`having count(*) filter (where js.skill_id in (select skill_id from mine)) > 0` : sql``}
      order by count(*) filter (where js.required and js.skill_id in (select skill_id from mine))::float
               / greatest(count(*) filter (where js.required), 1) desc, j.posted_at desc
      limit 15`,
    // Top 50, so a category filter still has its own top 10 to show.
    sql<Leader[]>`
      select s.slug, s.name, s.category, count(distinct js.job_id)::int as jobs,
             s.id = any(${ids}::int[]) as has,
             count(distinct js.job_id) filter (where js.posted_at > now() - interval '7 days')::int as week,
             count(distinct js.job_id) filter (where js.posted_at <= now() - interval '7 days' and js.posted_at > now() - interval '14 days')::int as prev
      from job_skills js join skills s on s.id = js.skill_id join jobs j on j.id = js.job_id
      where js.posted_at > now() - interval '60 days' and ${area}
      group by s.id order by jobs desc limit 50`,
  ]);

  const links = jobs.length
    ? await sql<GraphLink[]>`
        select js.job_id, s.id as skill_id, s.slug, s.name, s.category, js.required,
               s.id = any(${ids}::int[]) as has
        from job_skills js join skills s on s.id = js.skill_id
        where js.job_id = any(${jobs.map((j) => j.id)}::text[])`
    : [];

  // Next skill = the must-have you're missing that the most of your closest jobs ask for.
  const missing = new Map<string, { slug: string; name: string; jobs: number }>();
  for (const l of links) {
    if (l.has || !l.required) continue;
    const m = missing.get(l.slug) ?? { slug: l.slug, name: l.name, jobs: 0 };
    m.jobs++;
    missing.set(l.slug, m);
  }
  const nextSkill: NextSkill = [...missing.values()].sort((a, b) => b.jobs - a.jobs)[0] ?? null;

  return { mine, jobs: [...jobs], links: [...links], leaders: [...leaders], nextSkill };
}

// New jobs from the last 7 days in your city (or remote in Canada) that ask for at least one skill you have.
export async function getNotifications(sub: string, city: string | null) {
  return [
    ...(await sql<{ title: string; url: string; company: string; posted_at: Date }[]>`
      select distinct on (j.posted_at, j.id) j.title, j.url, c.name as company, j.posted_at
      from jobs j join companies c on c.id = j.company_id join job_skills js on js.job_id = j.id
      where j.posted_at > now() - interval '7 days'
        and (j.city = ${city} or j.remote)
        and js.skill_id in (select skill_id from user_skills where user_sub = ${sub} and status = 'have')
      order by j.posted_at desc, j.id limit 8`),
  ];
}

export type SavedJob = { id: string; title: string; company: string; url: string };

// Left panel: jobs you saved, and skills you started learning.
export async function getSavedAndStarted(sub: string) {
  const [saved, started] = await Promise.all([
    sql<SavedJob[]>`
      select j.id, j.title, c.name as company, j.url
      from saved_jobs sj join jobs j on j.id = sj.job_id join companies c on c.id = j.company_id
      where sj.user_sub = ${sub} order by sj.saved_at desc`,
    sql<MySkill[]>`
      select s.id, s.slug, s.name, s.category from user_skills us join skills s on s.id = us.skill_id
      where us.user_sub = ${sub} and us.status = 'learning' order by s.name`,
  ]);
  return { saved: [...saved], started: [...started] };
}
