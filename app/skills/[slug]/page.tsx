import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getExtras } from "@/lib/extras";
import { inScope, resolveScope } from "@/lib/scope";
import { ago } from "@/lib/ago";
import { ScopeSwitch } from "@/components/scope-switch";
import { TrendChart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SkillPage({ params, searchParams }: PageProps<"/skills/[slug]">) {
  const { slug } = await params;
  const [skill] = await sql<{ id: number; slug: string; name: string }[]>`select id, slug, name from skills where slug = ${slug}`;
  if (!skill) notFound();
  const { scope, cities, note } = await resolveScope(await searchParams);
  const area = inScope(scope);

  const [jobs, companies, trend, related, learners, stories, extras] = await Promise.all([
    sql<{ title: string; url: string; posted_at: Date; company: string }[]>`
      select j.title, j.url, j.posted_at, c.name as company
      from job_skills js join jobs j on j.id = js.job_id join companies c on c.id = j.company_id
      where js.skill_id = ${skill.id} and ${area} order by j.posted_at desc limit 25`,
    sql<{ name: string; jobs: number }[]>`
      select c.name, count(*)::int as jobs
      from job_skills js join jobs j on j.id = js.job_id join companies c on c.id = j.company_id
      where js.skill_id = ${skill.id} and ${area} group by c.name order by jobs desc`,
    // Weekly demand, grouped by the date each company posted the job.
    sql<{ week: Date; jobs: number }[]>`
      select date_trunc('week', js.posted_at) as week, count(*)::int as jobs
      from job_skills js join jobs j on j.id = js.job_id
      where js.skill_id = ${skill.id} and ${area} and js.posted_at > now() - interval '120 days'
      group by week order by week`,
    // "Learn next": skills that show up in the same job posts.
    sql<{ slug: string; name: string; together: number }[]>`
      select s.slug, s.name, count(*)::int as together
      from job_skills a join job_skills b on b.job_id = a.job_id and b.skill_id <> a.skill_id
      join skills s on s.id = b.skill_id
      where a.skill_id = ${skill.id} group by s.slug, s.name order by together desc limit 8`,
    sql<{ n: number }[]>`select count(*)::int as n from user_skills where skill_id = ${skill.id} and status = 'learning'`,
    sql<{ person: string; role: string | null; company: string | null; quote: string }[]>`
      select person, role, company, quote from stories where skill_id = ${skill.id}`,
    getExtras(skill),
  ]);

  return (
    <main className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{skill.name}</h1>
        <p className="text-muted-foreground">
          Asked for in {jobs.length === 25 ? "25+" : jobs.length} job posts at {companies.length} companies
          {extras.adzuna_count !== null && ` · ${extras.adzuna_count} Calgary job ads mention it (Adzuna)`}
          {learners[0].n > 0 && ` · ${learners[0].n} people are learning it here`}
        </p>
        <ScopeSwitch scope={scope} cities={cities} />
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
        <div className="flex flex-wrap gap-2">
          {companies.map((c) => <Badge key={c.name} variant="secondary">{c.name} · {c.jobs}</Badge>)}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Demand by week</CardTitle></CardHeader>
        <CardContent><TrendChart data={[...trend]} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Newest job posts</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li key={j.url}>
                <a className="underline-offset-4 hover:underline" href={j.url} target="_blank" rel="noreferrer">{j.title}</a>
                <span className="text-muted-foreground"> · {j.company} · {ago(j.posted_at)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {related.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Learn next</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link key={r.slug} href={`/skills/${r.slug}`}><Badge variant="outline">{r.name}</Badge></Link>
            ))}
          </CardContent>
        </Card>
      )}

      {extras.resources.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Where to learn it</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {extras.resources.map((r) => (
                <li key={r.url}><a className="underline-offset-4 hover:underline" href={r.url} target="_blank" rel="noreferrer">{r.title}</a></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {extras.projects.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Projects to prove it <Badge variant="outline">AI-suggested</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {extras.projects.map((p) => (
              <div key={p.title}>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {stories.length > 0 && (
        <Card>
          <CardHeader><CardTitle>From people who use it</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stories.map((s) => (
              <blockquote key={s.person}>
                “{s.quote}” <span className="text-muted-foreground">— {s.person}{s.role && `, ${s.role}`}{s.company && `, ${s.company}`}</span>
              </blockquote>
            ))}
          </CardContent>
        </Card>
      )}
      {/* Auth0 save buttons ("I have this" / "I'm learning this") go here once lib/auth0.ts is real */}
    </main>
  );
}
