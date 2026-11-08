"use client";
// /explore's list: every mapped job with its skills, filtered by job type and a search over title, company and skills.
// Must-have skills come first and are solid; nice-to-haves are outlined. Each skill opens its Learning guide.
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { ago } from "@/lib/ago";
import { categoryColor } from "@/lib/categories";
import { JOB_TYPES, type JobType } from "@/lib/roles";
import { CompanyLogo } from "@/components/dashboard/icons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type JobSkill = { slug: string; name: string; category: string | null; required: boolean };
export type ListJob = {
  id: string; title: string; url: string; company: string; city: string | null; remote: boolean;
  posted_at: string; internship: boolean; skills: JobSkill[];
};

const CHIPS = 8; // more than that and a row turns into a wall of chips

export function JobList({ jobs }: { jobs: ListJob[] }) {
  const [type, setType] = useState<JobType>("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = jobs.filter(
    (j) =>
      (type === "all" || (type === "internship") === j.internship) &&
      (!q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.skills.some((s) => s.name.toLowerCase().includes(q))),
  );

  return (
    <section aria-label="Mapped jobs" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup aria-label="Job type" value={[type]} onValueChange={(v) => v[0] && setType(v[0] as JobType)} className="flex-wrap justify-start gap-1.5">
          {JOB_TYPES.map((t) => (
            <ToggleGroupItem key={t.value} value={t.value} className="h-9 rounded-full px-3.5 aria-pressed:bg-foreground aria-pressed:text-background">
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Input
          type="search"
          aria-label="Search jobs, companies and skills"
          placeholder="Search a job, company or skill"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full rounded-full bg-white px-4 sm:w-auto sm:min-w-0 sm:max-w-xs sm:flex-1"
        />
        <p role="status" className="text-sm text-muted-foreground tabular-nums sm:ml-auto">{shown.length} {shown.length === 1 ? "job" : "jobs"}</p>
      </div>

      <ol className="surface flex flex-col p-2">
        {shown.map((j) => (
          <li key={j.id} className="flex gap-4 rounded-[1.25rem] px-4 py-4 transition-colors hover:bg-secondary/60">
            <CompanyLogo name={j.company} className="mt-0.5 size-9 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="flex flex-col gap-0.5">
                <a href={j.url} target="_blank" rel="noopener" className="group inline-flex items-start gap-1 font-medium leading-snug hover:underline">
                  {j.title}
                  <ArrowUpRightIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="sr-only">(opens the job post)</span>
                </a>
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                  {j.internship && <Badge variant="secondary">Internship</Badge>}
                  {j.company} · {j.remote ? "Remote in Canada" : j.city ?? "Canada"} · {ago(j.posted_at)}
                </p>
              </div>
              <ul aria-label="Skills it asks for" className="flex flex-wrap gap-1.5">
                {j.skills.slice(0, CHIPS).map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/skills/${s.slug}`}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] transition-colors hover:bg-secondary ${s.required ? "border-transparent bg-secondary" : "border-border bg-white text-muted-foreground"}`}
                    >
                      <span aria-hidden className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
                      {s.name}
                      {!s.required && <span className="sr-only">(nice to have)</span>}
                    </Link>
                  </li>
                ))}
                {j.skills.length > CHIPS && <li className="inline-flex h-7 items-center px-1.5 text-[13px] text-muted-foreground">+{j.skills.length - CHIPS} more</li>}
              </ul>
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No mapped jobs match that yet.</li>}
      </ol>
    </section>
  );
}
