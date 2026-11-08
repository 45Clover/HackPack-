// The signed-out landing page. It sells one action, "See my skill map" (the guest onboarding).
// Every number here is live from Neon: the hero map, the proof bar and the top-5 list.
import Link from "next/link";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import { sql } from "@/lib/db";
import { getDashboardFor } from "@/lib/dashboard";
import { inScope, resolveScope } from "@/lib/scope";
import { ago } from "@/lib/ago";
import { categoryColor } from "@/lib/categories";
import { SkillIcon } from "@/components/dashboard/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { HeroMap } from "./hero-map";
import { Format, Hub, Rebuild } from "@lucasmarkes/hairline/react";
import { SmoothScroll } from "./smooth-scroll";
import { Rise } from "./rise";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";

type SearchParams = Record<string, string | string[] | undefined>;
type Stats = { jobs: number; week: number; companies: number; skills: number; newest: Date | null; area: number };

const cta = buttonVariants({ className: "h-11 gap-2 px-5 text-[15px] active:scale-[0.97]" });

export async function Landing({ searchParams }: { searchParams: SearchParams }) {
  // All of Canada by default; ?city=… or ?scope=city&city=… still picks one city.
  const { scope, note } = await resolveScope({ scope: searchParams.city ? "city" : "canada", ...searchParams });
  const [map, [stats], [waitlist]] = await Promise.all([
    getDashboardFor([], scope, null), // no skills yet: the 15 newest jobs in the area and the skills they ask for
    sql<Stats[]>`
      select count(*)::int as jobs,
             count(*) filter (where j.posted_at > now() - interval '7 days')::int as week,
             count(distinct j.company_id)::int as companies,
             (select count(distinct skill_id)::int from job_skills where posted_at > now() - interval '60 days') as skills,
             max(j.posted_at) as newest,
             count(*) filter (where ${inScope(scope)})::int as area
      from jobs j where j.posted_at > now() - interval '60 days'`,
    sql<{ count: number }[]>`select count(*)::int as count from waitlist`,
  ]);

  const where = scope.kind === "canada" ? "Canada" : scope.city;
  const areaText = scope.kind === "canada" ? "across Canada" : `in ${scope.city} and remote across Canada`;
  const top = map.leaders.slice(0, 5);
  const qs = scope.kind === "canada" ? "?scope=canada" : `?city=${encodeURIComponent(scope.city)}`; // the guide opens on the same area
  const fresh = stats.newest ? ago(stats.newest) : "none yet";
  const proof = [
    { value: stats.jobs.toLocaleString("en-CA"), label: "job posts in Canada, last 60 days" },
    { value: stats.week.toLocaleString("en-CA"), label: "of them posted this week" },
    { value: stats.companies.toLocaleString("en-CA"), label: "companies hiring" },
    { value: fresh[0].toUpperCase() + fresh.slice(1), label: "newest post" },
  ];

  return (
    <Rise className="mx-auto flex w-full max-w-[1200px] flex-col gap-20 pb-10 lg:gap-28">
      <SmoothScroll />
      {/* 1. Hero: the promise on the left, the real map turning on the right, on plain paper. */}
      <section className="relative isolate grid min-h-[calc(100svh-72px)] items-center gap-8 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:py-12">
        {/* Full bleed, from under the header to the hero's bottom edge, where it fades into the page. */}
        <div aria-hidden className="scene-bg pointer-events-none absolute -top-[72px] bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2">
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#f4f3ef]" />
        </div>
        <div className="flex min-w-0 flex-col items-start gap-6">
          <Badge data-reveal variant="outline" className="h-auto min-h-7 gap-2 bg-white px-3 py-1 text-left text-[13px] font-normal whitespace-normal text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-[var(--blue)]" />
            Live from {stats.area} {scope.kind === "canada" ? "job posts across Canada" : `${scope.city} and remote job posts`}
          </Badge>
          <h1 data-reveal className="text-[40px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-[58px]">
            See the skills {where} is hiring for, and how close you are.
          </h1>
          <p data-reveal className="max-w-[46ch] text-[17px] leading-relaxed text-muted-foreground">
            We map the skills in real job posts from {stats.companies} tech companies. Tell us what you know. See the jobs you&apos;re closest to, and the one skill that gets you closer.
          </p>
          <div data-reveal className="flex flex-wrap items-center gap-3">
            <Link href="/onboarding" className={cta}>
              See my skill map <ArrowRightIcon aria-hidden />
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "ghost", className: "h-11 px-4 text-[15px] active:scale-[0.97]" })}>
              Sign in
            </Link>
          </div>
          <p data-reveal className="text-sm text-muted-foreground">Free. No sign-up to see your map. Your resume is never saved.</p>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>

        {/* Phones: job titles would pile up, so only skill names show; the caption sits under the map. */}
        <figure data-reveal className="relative flex flex-col gap-3 max-lg:[&_.graph-label[data-kind=job]]:hidden">
          <div className="h-[380px] sm:h-[460px] lg:h-[min(760px,calc(100svh-150px))]">
            <HeroMap jobs={map.jobs} links={map.links} />
          </div>
          <figcaption className="px-2 text-xs leading-relaxed text-muted-foreground lg:pointer-events-none lg:bg-white lg:shadow-sm lg:absolute lg:bottom-3 lg:left-3 lg:max-w-[calc(100%-24px)] lg:rounded-full lg:px-3.5 lg:py-1.5">
            The {map.jobs.length} newest jobs {areaText}. <span className="text-foreground">Diamonds</span> are jobs, <span className="text-foreground">rings</span> are the skills they ask for.
          </figcaption>
        </figure>
      </section>

      {/* 2. Proof: live counts, specific. */}
      <section aria-label="The data behind the map" className="-mt-8 flex flex-col gap-3 lg:-mt-14">
        <dl data-reveal className="surface grid grid-cols-2 gap-y-6 px-6 py-6 lg:grid-cols-4 lg:px-2">
          {proof.map((p) => (
            <div key={p.label} className="flex flex-col gap-1 lg:border-l lg:border-border lg:px-8 lg:first:border-l-0">
              <dt className="order-2 text-sm text-muted-foreground">{p.label}</dt>
              <dd className="order-1 text-3xl font-semibold tracking-tight tabular-nums lg:text-4xl">{p.value}</dd>
            </div>
          ))}
        </dl>
        <p data-reveal className="px-2 text-xs text-muted-foreground">
          Pulled from the companies&apos; own job boards (Ashby, Greenhouse and Lever). Counts are live.
        </p>
      </section>

      {/* 3. How it works. */}
      <section aria-labelledby="how" className="flex flex-col gap-8">
        <h2 id="how" data-reveal className="text-3xl font-semibold tracking-tight lg:text-4xl">How it works</h2>
        {/* Each step has a Hairline figure (@lucasmarkes/hairline) that acts it out: a file read line by line, the jobs
            around you, and one skill lifting everything that needs it. Decorative: the text says the same. */}
        <ol className="hairline-warm grid gap-4 lg:grid-cols-3">
          {[
            { title: "Tell us what you know", body: "Upload your resume or answer a few questions. The file is read in memory and never saved. No AI reads it.", tag: "Never saved", Figure: Format },
            { title: "See the real jobs you're closest to", body: "Every job gets a match score from its must-have skills. You see what you already have and what's missing.", Figure: Hub },
            { title: "Learn the next skill", body: "Its learning guide shows how demand has moved week by week, and the best free places to learn it.", Figure: Rebuild },
          ].map(({ Figure, ...s }, i) => (
            <li key={s.title} data-reveal className="surface flex flex-col gap-4 p-7">
              <Figure play aria-hidden className="-mx-3 -mt-3" />
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-full bg-[var(--ink)] text-sm font-semibold text-[#f4f3ef] tabular-nums">{i + 1}</span>
                {s.tag && <Badge variant="secondary">{s.tag}</Badge>}
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Top skills: the text twin of the map. */}
      {top.length > 0 && (
        <section aria-labelledby="top" className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          <div className="flex flex-col gap-4 lg:pt-6">
            <h2 id="top" data-reveal className="text-3xl font-semibold tracking-tight text-balance lg:text-4xl">Top skills in {where} right now</h2>
            <p data-reveal className="max-w-[44ch] leading-relaxed text-muted-foreground">
              The five skills the most job posts ask for {areaText}, last 60 days. Open one to see who&apos;s hiring and where to learn it for free.
            </p>
          </div>
          <ol data-reveal className="surface flex flex-col p-3">
            {top.map((s, i) => (
              <li key={s.slug}>
                <Link href={`/skills/${s.slug}${qs}`} className="group flex items-center gap-4 rounded-[1.25rem] px-4 py-3.5 transition-colors hover:bg-secondary">
                  <span className="w-4 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
                    <SkillIcon slug={s.slug} category={s.category} className="size-4.5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{s.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{s.jobs} jobs</span>
                    </span>
                    <span aria-hidden className="h-1 overflow-hidden rounded-full bg-secondary">
                      <span data-bar className="block h-full rounded-full" style={{ width: `${(s.jobs / top[0].jobs) * 100}%`, background: categoryColor(s.category) }} />
                    </span>
                  </span>
                  <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 5. Pre-registration (db/010). The count shows from 10 people up: fewer reads as empty. */}
      <section aria-labelledby="early" className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div className="flex flex-col gap-4 lg:pt-6">
          <h2 id="early" data-reveal className="text-3xl font-semibold tracking-tight text-balance lg:text-4xl">Get early access</h2>
          <p data-reveal className="max-w-[44ch] leading-relaxed text-muted-foreground">
            Skilltri is in beta, built at Hack the Change 2026, and internships are coming. Join to hear the day it opens.
          </p>
          {waitlist.count >= 10 && (
            <p data-reveal className="text-sm text-muted-foreground tabular-nums">{waitlist.count.toLocaleString("en-CA")} people have joined</p>
          )}
        </div>
        <div data-reveal className="surface p-7">
          <WaitlistForm source="landing" />
        </div>
      </section>

      {/* 6. The same one action, once more. */}
      <section data-reveal className="surface-ink flex flex-col items-center gap-6 px-6 py-16 text-center lg:py-20">
        <h2 className="max-w-[20ch] text-3xl font-semibold tracking-tight text-balance lg:text-5xl">See the jobs you&apos;re closest to.</h2>
        <p className="max-w-[46ch] leading-relaxed text-[#f4f3ef]/70">
          Your map shows the real jobs {areaText} that fit you best, and the skill to learn next.
        </p>
        <Link href="/onboarding" className={buttonVariants({ variant: "secondary", className: "h-11 gap-2 px-5 text-[15px] active:scale-[0.97]" })}>
          See my skill map <ArrowRightIcon aria-hidden />
        </Link>
        <p className="text-sm text-[#f4f3ef]/60">Free. No sign-up until you&apos;ve seen your map.</p>
      </section>
    </Rise>
  );
}
