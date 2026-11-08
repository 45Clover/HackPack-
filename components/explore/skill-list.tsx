"use client";
// /explore's ranked list: every skill job posts ask for, with a category filter. The text twin of the map above it.
// Each row opens that skill's Learning guide (the drawer), on the same area.
import { useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import { SkillIcon } from "@/components/dashboard/icons";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ListSkill = { slug: string; name: string; category: string | null; jobs: number; companies: number };

const SHOWN = 20; // the rest behind "Show all": a list of ~190 rows is a wall
const chip = "h-9 gap-2 rounded-full px-3.5 aria-pressed:bg-foreground aria-pressed:text-background lg:w-full lg:justify-start";

export function SkillList({ skills, qs, areaText }: { skills: ListSkill[]; qs: string; areaText: string }) {
  const [category, setCategory] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const count = (slug: string) => skills.filter((s) => s.category === slug).length;
  const list = category === "all" ? skills : skills.filter((s) => s.category === category);
  const shown = showAll ? list : list.slice(0, SHOWN);
  const most = list[0]?.jobs ?? 1;

  return (
    <section aria-labelledby="all-skills" className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12">
      <div className="flex flex-col gap-5 lg:sticky lg:top-24">
        <h2 id="all-skills" className="text-3xl font-semibold tracking-tight lg:text-4xl">Every skill, ranked</h2>
        <p className="max-w-[40ch] leading-relaxed text-muted-foreground">
          By how many job posts ask for it {areaText}, last 60 days. Open one to see who&apos;s hiring and where to learn it for free.
        </p>
        <ToggleGroup
          aria-label="Category"
          value={[category]}
          onValueChange={(v) => { if (v[0]) { setCategory(String(v[0])); setShowAll(false); } }}
          className="flex-wrap justify-start gap-1.5 lg:w-64 lg:flex-col lg:items-stretch"
        >
          <ToggleGroupItem value="all" className={chip}>
            All skills <span className="ml-auto text-xs tabular-nums opacity-60">{skills.length}</span>
          </ToggleGroupItem>
          {CATEGORIES.filter((c) => count(c.slug) > 0).map((c) => (
            <ToggleGroupItem key={c.slug} value={c.slug} className={chip}>
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />
              {c.name}
              <span className="ml-auto text-xs tabular-nums opacity-60">{count(c.slug)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="surface flex flex-col p-3">
        <ol>
          {shown.map((s, i) => (
            <li key={s.slug}>
              <Link href={`/skills/${s.slug}${qs}`} className="group flex items-center gap-4 rounded-[1.25rem] px-4 py-3.5 transition-colors hover:bg-secondary">
                <span className="w-6 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
                  <SkillIcon slug={s.slug} category={s.category} className="size-4.5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                      {s.jobs} {s.jobs === 1 ? "job" : "jobs"}
                      <span className="max-sm:hidden"> · {s.companies} {s.companies === 1 ? "company" : "companies"}</span>
                    </span>
                  </span>
                  <span aria-hidden className="h-1 overflow-hidden rounded-full bg-secondary">
                    <span className="block h-full rounded-full" style={{ width: `${(s.jobs / most) * 100}%`, background: categoryColor(s.category) }} />
                  </span>
                </span>
                <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ol>
        {list.length > SHOWN && (
          <Button variant="ghost" className="mt-1 h-11 rounded-[1.25rem] text-muted-foreground" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show fewer" : `Show all ${list.length}`}
          </Button>
        )}
      </div>
    </section>
  );
}
