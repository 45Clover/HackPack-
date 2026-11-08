// The Learning guide for one skill: how much it's wanted (a weekly line), who's hiring for it, what to learn next,
// and the best free places to learn it, at the bottom.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowUpRightIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { sql } from "@/lib/db";
import { getExtras } from "@/lib/extras";
import { resourcesFor } from "@/lib/resources";
import { inScope, resolveScope } from "@/lib/scope";
import { ago } from "@/lib/ago";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import { ScopeSwitch } from "@/components/scope-switch";
import { DemandChart } from "@/components/skill/demand-chart";
import { Reveal } from "@/components/skill/reveal";
import { CompanyLogo, SiteIcon, SkillIcon } from "@/components/dashboard/icons";
import { Badge } from "@/components/ui/badge";

const WEEKS = 16;

export default async function SkillPage({ params, searchParams }: PageProps<"/skills/[slug]">) {
  const { slug } = await params;
  const [skill] = await sql<{ id: number; slug: string; name: string; category: string | null }[]>`
    select id, slug, name, category from skills where slug = ${slug}`;
  if (!skill) notFound();
  const { scope, cities, note } = await resolveScope(await searchParams);
  const area = inScope(scope);

  const [jobs, companies, weeks, related, learners, stories, extras] = await Promise.all([
    sql<{ title: string; url: string; posted_at: Date; company: string; city: string | null; remote: boolean }[]>`
      select j.title, j.url, j.posted_at, c.name as company, j.city, j.remote
      from job_skills js join jobs j on j.id = js.job_id join companies c on c.id = j.company_id
      where js.skill_id = ${skill.id} and ${area} order by j.posted_at desc limit 6`,
    sql<{ name: string; jobs: number }[]>`
      select c.name, count(*)::int as jobs
      from job_skills js join jobs j on j.id = js.job_id join companies c on c.id = j.company_id
      where js.skill_id = ${skill.id} and ${area} group by c.name order by jobs desc`,
    // Every week of the last 16, zeros included, so the line never skips a quiet week.
    sql<{ week: Date; jobs: number }[]>`
      select w.week, count(x.job_id)::int as jobs
      from generate_series(date_trunc('week', now()) - interval '${sql.unsafe(String(WEEKS - 1))} weeks', date_trunc('week', now()), interval '1 week') as w(week)
      left join (
        select js.job_id, js.posted_at from job_skills js join jobs j on j.id = js.job_id
        where js.skill_id = ${skill.id} and ${area}
      ) x on date_trunc('week', x.posted_at) = w.week
      group by w.week order by w.week`,
    // "Learn next": skills that show up in the same job posts.
    sql<{ slug: string; name: string; category: string | null; together: number }[]>`
      select s.slug, s.name, s.category, count(*)::int as together
      from job_skills a join job_skills b on b.job_id = a.job_id and b.skill_id <> a.skill_id
      join skills s on s.id = b.skill_id
      where a.skill_id = ${skill.id} group by s.slug, s.name, s.category order by together desc limit 8`,
    sql<{ n: number }[]>`select count(*)::int as n from user_skills where skill_id = ${skill.id} and status = 'learning'`,
    sql<{ person: string; role: string | null; company: string | null; quote: string }[]>`
      select person, role, company, quote from stories where skill_id = ${skill.id}`,
    getExtras(skill),
  ]);

  const total = companies.reduce((n, c) => n + c.jobs, 0);
  const recent = weeks.slice(-4).reduce((n, w) => n + w.jobs, 0);
  const before = weeks.slice(-8, -4).reduce((n, w) => n + w.jobs, 0);
  const where = scope.kind === "canada" ? "across Canada" : `in ${scope.city} (and remote)`;
  const category = CATEGORIES.find((c) => c.slug === skill.category);
  // AI-found links first (when Tomi's extras have run), then the hand-picked ones; no duplicates.
  const resources = [...extras.resources.map((r) => ({ ...r, kind: "Guide" as const })), ...resourcesFor(skill)]
    .filter((r, i, all) => all.findIndex((x) => x.url === r.url) === i);

  return (
    <Reveal className="mx-auto max-w-6xl space-y-8 pt-4 pb-16">
      <Link data-reveal href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeftIcon className="size-4" />Your skill map
      </Link>

      <header data-reveal className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="grid size-16 shrink-0 place-items-center rounded-[20px] text-white" style={{ background: categoryColor(skill.category) }}>
            <SkillIcon slug={skill.slug} category={skill.category} className="size-8" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{category?.name ?? "Skill"} · Learning guide</p>
            <h1 className="text-5xl leading-tight font-medium tracking-tight">{skill.name}</h1>
          </div>
        </div>
        <ScopeSwitch scope={scope} cities={cities} />
      </header>

      <p data-reveal className="max-w-2xl text-lg text-muted-foreground">
        Asked for in <span className="text-foreground">{total} job posts</span> at <span className="text-foreground">{companies.length} companies</span> {where}
        {learners[0].n > 0 && <>, and {learners[0].n} people here are learning it</>}.
      </p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section data-reveal aria-labelledby="demand" className="surface p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="demand" className="text-lg font-medium tracking-tight">Demand over time</h2>
              <p className="text-sm text-muted-foreground">Job posts asking for {skill.name}, by week, last {WEEKS} weeks</p>
            </div>
            <div className="text-right">
              <p className="text-3xl leading-none font-medium tabular-nums">{recent}</p>
              <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                {recent !== before && (recent > before
                  ? <TrendingUpIcon aria-hidden className="size-3.5 text-[var(--have)]" />
                  : <TrendingDownIcon aria-hidden className="size-3.5" />)}
                in the last 4 weeks · {before} the 4 before
              </p>
            </div>
          </div>
          <div className="mt-6">
            <DemandChart weeks={weeks.map((w) => ({ week: new Date(w.week).toISOString(), jobs: w.jobs }))} />
          </div>
        </section>

        <section data-reveal aria-labelledby="hiring" className="surface flex flex-col p-6">
          <h2 id="hiring" className="text-lg font-medium tracking-tight">Who&apos;s hiring</h2>
          <p className="text-sm text-muted-foreground">Companies with posts that ask for it</p>
          <ul className="mt-5 space-y-3">
            {companies.slice(0, 7).map((c) => (
              <li key={c.name} className="flex items-center gap-3">
                <CompanyLogo name={c.name} />
                <span className="flex-1 truncate text-sm">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.jobs}</span>
              </li>
            ))}
            {companies.length === 0 && <p className="text-sm text-muted-foreground">No posts here yet. Try all of Canada.</p>}
          </ul>
        </section>

        <section data-reveal aria-labelledby="newest" className="surface p-6 lg:col-span-2">
          <h2 id="newest" className="text-lg font-medium tracking-tight">Newest job posts</h2>
          <ul className="mt-4 -mx-2">
            {jobs.map((j) => (
              <li key={j.url}>
                <a href={j.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-secondary">
                  <CompanyLogo name={j.company} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{j.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{j.company} · {j.remote ? "Remote" : j.city ?? "Canada"} · {ago(j.posted_at)}</span>
                  </span>
                  <ArrowUpRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section data-reveal aria-labelledby="next" className="surface p-6">
          <h2 id="next" className="text-lg font-medium tracking-tight">Learn next</h2>
          <p className="text-sm text-muted-foreground">Asked for in the same posts</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/skills/${r.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[13px] transition-[transform,background-color] duration-150 hover:bg-secondary active:scale-[0.97]"
              >
                <span style={{ color: categoryColor(r.category) }}><SkillIcon slug={r.slug} category={r.category} /></span>
                {r.name}
              </Link>
            ))}
            {related.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          </div>
        </section>
      </div>

      <section aria-labelledby="resources" className="space-y-5 pt-4">
        <div data-reveal>
          <h2 id="resources" className="text-2xl font-medium tracking-tight">Best resources</h2>
          <p className="text-muted-foreground">Free, and hand-picked. Start with the first one.</p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map((r, i) => (
            <li key={r.url} data-reveal>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="surface group flex h-full flex-col gap-5 p-5 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgb(20_20_19/0.04),0_24px_48px_-24px_rgb(20_20_19/0.28)] active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <SiteIcon url={r.url} />
                  <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="flex-1 space-y-2">
                  <Badge variant="secondary">{r.kind}</Badge>
                  <p className="font-medium leading-snug">{r.title}</p>
                </div>
                <p className="flex items-center justify-between text-xs text-muted-foreground">
                  {new URL(r.url).hostname.replace(/^www\./, "")}
                  <ArrowUpRightIcon aria-hidden className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </p>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {extras.projects.length > 0 && (
        <section data-reveal aria-labelledby="projects" className="surface space-y-4 p-6">
          <h2 id="projects" className="flex items-center gap-2 text-lg font-medium tracking-tight">Projects to prove it <Badge variant="outline">AI-suggested</Badge></h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {extras.projects.map((p) => (
              <li key={p.title}>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stories.length > 0 && (
        <section data-reveal aria-labelledby="stories" className="surface space-y-3 p-6">
          <h2 id="stories" className="text-lg font-medium tracking-tight">From people who use it</h2>
          {stories.map((s) => (
            <blockquote key={s.person}>
              “{s.quote}” <span className="text-muted-foreground">— {s.person}{s.role && `, ${s.role}`}{s.company && `, ${s.company}`}</span>
            </blockquote>
          ))}
        </section>
      )}
    </Reveal>
  );
}
