import { sql } from "@/lib/db";
import { inScope, resolveScope } from "@/lib/scope";
import { ScopeSwitch } from "@/components/scope-switch";
import { SkillGraph, type Edge } from "@/components/skill-graph";
import { SkillTable, type SkillRow } from "@/components/skill-table";

type SearchParams = Record<string, string | string[] | undefined>;

// The public skill map: what everyone sees signed out, and /explore for signed-in users.
export async function PublicMap({ searchParams }: { searchParams: SearchParams }) {
  const { scope, cities, note } = await resolveScope(searchParams);

  const skills = await sql<(SkillRow & { id: number })[]>`
    select s.id, s.slug, s.name, count(distinct js.job_id)::int as jobs,
           count(distinct j.company_id)::int as companies, max(js.posted_at) as latest
    from job_skills js
    join skills s on s.id = js.skill_id
    join jobs j on j.id = js.job_id
    where js.posted_at > now() - interval '60 days' and ${inScope(scope)}
    group by s.id order by jobs desc limit 40`;

  const edges = await sql<Edge[]>`
    select c.name as company, s.slug, s.name as skill, count(*)::int as jobs
    from job_skills js
    join skills s on s.id = js.skill_id
    join jobs j on j.id = js.job_id
    join companies c on c.id = j.company_id
    where js.posted_at > now() - interval '60 days' and ${inScope(scope)}
      and s.id = any(${skills.slice(0, 25).map((s) => s.id)}::int[])
    group by c.name, s.slug, s.name`;

  const where = scope.kind === "canada" ? "Canadian" : scope.city;
  return (
    <main className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">What tech skills {where} companies are hiring for right now</h1>
        {/* People + pitch adds the StatCan headline number here */}
        <ScopeSwitch scope={scope} cities={cities} />
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
        <p className="text-sm text-muted-foreground"><a className="underline underline-offset-4" href="/auth/login?returnTo=/onboarding">Sign in</a> and upload your resume to see the real jobs you&apos;re closest to.</p>
      </div>
      {skills.length === 0 ? (
        <p className="text-muted-foreground">No skills yet. They appear once the ingest script has run.</p>
      ) : (
        <>
          {/* Spread: postgres.js returns an array with extra props; client components need a plain array. */}
          <SkillGraph edges={[...edges]} />
          <SkillTable skills={[...skills]} />
        </>
      )}
    </main>
  );
}
