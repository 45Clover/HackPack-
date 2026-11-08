import Link from "next/link";
import { auth0, authReady } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { getDashboardFor } from "@/lib/dashboard";
import { inScope, resolveScope } from "@/lib/scope";
import { ScopeSwitch } from "@/components/scope-switch";
import { HeroMap } from "@/components/landing/hero-map";
import { SkillList, type ListSkill } from "@/components/explore/skill-list";

type SearchParams = Record<string, string | string[] | undefined>;

// /explore, the public skill map: the live 3D map of the newest jobs and the skills they ask for (the landing's), then
// every skill job posts ask for, ranked, with a category filter. Each one opens its Learning guide.
export async function PublicMap({ searchParams }: { searchParams: SearchParams }) {
  const { scope, cities, note } = await resolveScope(searchParams);
  const area = inScope(scope);
  const [session, map, skills, [stats]] = await Promise.all([
    authReady ? auth0.getSession() : null,
    getDashboardFor([], scope, null), // no skills: the 15 newest jobs in the area and the skills they ask for
    sql<ListSkill[]>`
      select s.slug, s.name, s.category, count(distinct js.job_id)::int as jobs, count(distinct j.company_id)::int as companies
      from job_skills js join skills s on s.id = js.skill_id join jobs j on j.id = js.job_id
      where js.posted_at > now() - interval '60 days' and ${area}
      group by s.id order by jobs desc, s.name`,
    sql<{ jobs: number; companies: number }[]>`
      select count(*)::int as jobs, count(distinct j.company_id)::int as companies
      from jobs j where j.posted_at > now() - interval '60 days' and ${area}`,
  ]);

  const where = scope.kind === "canada" ? "Canada" : scope.city;
  const areaText = scope.kind === "canada" ? "across Canada" : `in ${scope.city} and remote across Canada`;
  const qs = scope.kind === "canada" ? "?scope=canada" : `?city=${encodeURIComponent(scope.city)}`; // the guide opens on the same area

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 pt-6 pb-10 lg:gap-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-[40px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance lg:text-5xl">The skills {where} is hiring for right now</h1>
          <p className="text-[17px] leading-relaxed text-muted-foreground">
            From {stats.jobs.toLocaleString("en-CA")} job posts at {stats.companies.toLocaleString("en-CA")} companies {areaText}, last 60 days.
            {!session && (
              <> <Link href="/onboarding" className="text-foreground underline underline-offset-4">See your own map</Link>: the jobs you&apos;re closest to.</>
            )}
          </p>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>
        <ScopeSwitch scope={scope} cities={cities} />
      </header>

      {skills.length === 0 ? (
        <p className="text-muted-foreground">No skills yet. They appear once the job feeds have been read.</p>
      ) : (
        <>
          {/* Phones: job titles would pile up, so only skill names show. */}
          <figure className="relative flex flex-col gap-3 max-lg:[&_.graph-label[data-kind=job]]:hidden">
            <div className="h-[380px] sm:h-[480px] lg:h-[560px]">
              <HeroMap jobs={map.jobs} links={map.links} />
            </div>
            <figcaption className="px-2 text-xs leading-relaxed text-muted-foreground lg:pointer-events-none lg:absolute lg:bottom-3 lg:left-3 lg:max-w-[calc(100%-24px)] lg:rounded-full lg:bg-white lg:px-3.5 lg:py-1.5 lg:shadow-sm">
              The {map.jobs.length} newest jobs {areaText}. <span className="text-foreground">Diamonds</span> are jobs, <span className="text-foreground">rings</span> are the skills they ask for. Click a skill to open its guide.
            </figcaption>
          </figure>
          <SkillList skills={[...skills]} qs={qs} areaText={areaText} />
        </>
      )}
    </main>
  );
}
