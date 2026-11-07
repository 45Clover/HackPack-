// DEV-ONLY design preview: the dashboard without Auth0 or the database.
// Real job posts fetched live from public feeds, skills matched by keyword (not Gemini), and a sample resume.
// shortcut: throwaway preview for design work; delete once the real dashboard runs on real data.
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { matchSkills } from "@/lib/resume";
import { parseLocation } from "@/lib/location";
import type { GraphJob, GraphLink, Leader, MySkill, NextSkill } from "@/lib/dashboard";
import { ProfileCard } from "@/components/dashboard/profile-card";
import { PersonalGraph } from "@/components/dashboard/personal-graph";
import { Leaderboard } from "@/components/dashboard/leaderboard";

const BOARDS = { benevity: "Benevity", neofinancial: "Neo Financial", jobber: "Jobber", cohere: "Cohere" };
const SAMPLE_RESUME = ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "PostgreSQL", "Git", "Python"];
const TECH = /engineer|developer|software|data|devops|sre|security|qa|analyst|architect|machine learning|cloud|platform|full.?stack|front.?end|back.?end|mobile/i;

// Skill dictionary = the example names in each category hint.
const DICT = CATEGORIES.flatMap((c, ci) =>
  c.hint.split(":")[1].split(",").map((n, i) => ({ id: ci * 100 + i, name: n.trim(), slug: n.trim().toLowerCase().replace(/[^a-z0-9+#]+/g, "-"), category: c.slug as string })),
);

type AshbyJob = { id: string; title: string; jobUrl: string; location: string; isRemote: boolean; publishedAt: string; descriptionPlain?: string; isListed: boolean };

export default async function Preview() {
  if (process.env.NODE_ENV !== "development") notFound();

  const feeds = await Promise.all(
    Object.entries(BOARDS).map(async ([board, company]) => {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${board}`, { cache: "no-store" });
      const { jobs } = (await res.json()) as { jobs: AshbyJob[] };
      return jobs.filter((j) => j.isListed && TECH.test(j.title)).map((j) => ({ ...j, company }));
    }),
  );
  const mineNames = new Set(SAMPLE_RESUME);
  const mine: MySkill[] = DICT.filter((s) => mineNames.has(s.name));

  const all = feeds.flat().map((j) => {
    const loc = parseLocation(`${j.location} ${j.isRemote ? "Remote" : ""}`);
    const skills = matchSkills(`${j.title}\n${j.descriptionPlain ?? ""}`, DICT);
    return { j, loc, skills };
  }).filter((x) => x.loc.canada && x.skills.length > 0);

  const scored = all.map(({ j, loc, skills }) => {
    const have = skills.filter((s) => mineNames.has(s.name)).length;
    const job: GraphJob = { id: j.id, title: j.title, url: j.jobUrl, company: j.company, city: loc.city, remote: loc.remote, posted_at: new Date(j.publishedAt), have, needed: skills.length };
    const links: GraphLink[] = skills.map((s) => ({ job_id: j.id, skill_id: s.id, slug: s.slug, name: s.name, category: s.category, required: true, has: mineNames.has(s.name) }));
    return { job, links };
  });
  const closest = scored.filter((x) => x.job.have > 0).sort((a, b) => b.job.have / b.job.needed - a.job.have / a.job.needed).slice(0, 15);

  const counts = new Map<string, Leader>();
  for (const { links } of scored) for (const l of links) {
    const c = counts.get(l.slug) ?? { slug: l.slug, name: l.name, category: l.category, jobs: 0, has: l.has };
    c.jobs++;
    counts.set(l.slug, c);
  }
  const leaders = [...counts.values()].sort((a, b) => b.jobs - a.jobs).slice(0, 10);

  const missing = new Map<string, { slug: string; name: string; jobs: number }>();
  for (const { links } of closest) for (const l of links) if (!l.has) {
    const m = missing.get(l.slug) ?? { slug: l.slug, name: l.name, jobs: 0 };
    m.jobs++;
    missing.set(l.slug, m);
  }
  const nextSkill: NextSkill = [...missing.values()].sort((a, b) => b.jobs - a.jobs)[0] ?? null;

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
        <strong>Design preview (dev only).</strong> {scored.length} real job posts fetched live from {Object.values(BOARDS).join(", ")}. Skills matched by keyword, not Gemini. &quot;You&quot; is a sample resume.{" "}
        <Link href="/preview/onboarding" className="underline underline-offset-4">See onboarding →</Link>
      </p>
      <main className="grid gap-4 lg:grid-cols-[1fr_3fr_1fr]">
        <aside className="space-y-4">
          <ProfileCard user={{ name: "Sample Student", picture: null }} role="Full-stack developer" city="Calgary" skills={mine} nextSkill={nextSkill} />
        </aside>
        <section className="min-w-0 space-y-3">
          <h1 className="text-xl font-semibold tracking-tight">You, your skills, and the jobs you&apos;re closest to</h1>
          <PersonalGraph mine={mine} jobs={closest.map((c) => c.job)} links={closest.flatMap((c) => c.links)} />
        </section>
        <aside className="space-y-4">
          <Leaderboard area="Canada" leaders={leaders} />
        </aside>
      </main>
    </div>
  );
}
