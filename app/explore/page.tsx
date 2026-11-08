import type { Metadata } from "next";
import Link from "next/link";
import { auth0, authReady } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { isInternship } from "@/lib/dashboard";
import { JobList, type ListJob } from "@/components/explore/job-list";

export const metadata: Metadata = { title: "Every mapped job | Skilltrii" };

// /explore: every job whose skills we've read (the same jobs the map can draw), newest first, each with the skills
// it asks for. Jobs Gemini hasn't read yet are left out, so this list, the map and the landing's counts agree.
export default async function Explore() {
  const [session, jobs] = await Promise.all([
    authReady ? auth0.getSession() : null,
    sql<ListJob[]>`
      select j.id, j.title, j.url, c.name as company, j.city, j.remote, j.posted_at::text as posted_at,
             ${isInternship()} as internship,
             json_agg(json_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'category', s.category, 'required', js.required)
                      order by js.required desc, s.name) as skills
      from jobs j
      join companies c on c.id = j.company_id
      join job_skills js on js.job_id = j.id
      join skills s on s.id = js.skill_id
      group by j.id, c.name
      order by j.posted_at desc`,
  ]);
  const companies = new Set(jobs.map((j) => j.company)).size;

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-10 pt-6 pb-10">
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-[40px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance lg:text-5xl">Every job we&apos;ve mapped</h1>
        <p className="text-[17px] leading-relaxed text-muted-foreground">
          {jobs.length} real job posts from {companies} companies across Canada, each with the skills it asks for. These are the jobs
          the map is drawn from. Open a skill to see who&apos;s hiring for it and where to learn it for free.
          {!session && <> <Link href="/onboarding" className="text-foreground underline underline-offset-4">See your own map</Link> to find the ones you&apos;re closest to.</>}
        </p>
      </header>
      <JobList jobs={[...jobs]} />
    </main>
  );
}
