"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import { ago } from "@/lib/ago";
import type { GraphJob, GraphLink, MySkill } from "@/lib/dashboard";

import type { Link as GraphEdge, Node } from "./graph-canvas";

const GraphCanvas = dynamic(() => import("./graph-canvas"), { ssr: false }); // canvas needs the browser

// You → your skills → the jobs you're closest to → the skills those jobs still need.
export function PersonalGraph({ mine, jobs, links }: { mine: MySkill[]; jobs: GraphJob[]; links: GraphLink[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [selected, setSelected] = useState<Node | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const nodes = new Map<string, Node>([["me", { id: "me", kind: "me", label: "You", fx: 0, fy: 0 }]]);
    const edges: GraphEdge[] = [];
    for (const s of mine) {
      nodes.set(`s:${s.slug}`, { id: `s:${s.slug}`, kind: "skill", label: s.name, has: true, slug: s.slug, category: s.category });
      edges.push({ source: "me", target: `s:${s.slug}` });
    }
    for (const j of jobs) nodes.set(`j:${j.id}`, { id: `j:${j.id}`, kind: "job", label: `${j.title} · ${j.company}`, job: j });
    for (const l of links) {
      if (!nodes.has(`s:${l.slug}`)) nodes.set(`s:${l.slug}`, { id: `s:${l.slug}`, kind: "skill", label: l.name, has: l.has, slug: l.slug, category: l.category });
      edges.push({ source: `j:${l.job_id}`, target: `s:${l.slug}` });
    }
    return { nodes: [...nodes.values()], links: edges };
  }, [mine, jobs, links]);

  const panelSkill = selected?.kind === "skill" ? selected : null;
  const panelJob = selected?.kind === "job" ? selected.job : null;

  return (
    <div className="space-y-4">
      <div ref={box} aria-hidden="true" className="overflow-hidden rounded-xl border bg-[#16161e]">
        {jobs.length === 0 ? (
          <p className="grid h-[560px] place-items-center px-6 text-center text-sm text-muted-foreground">
            No matching jobs yet. Add more skills, or switch to all of Canada.
          </p>
        ) : (
          <GraphCanvas data={data} width={width} height={560} onSelect={setSelected} />
        )}
      </div>

      <Legend />

      {/* The accessible twin of the graph, and the fastest read for judges. */}
      <section aria-labelledby="closest-jobs">
        <h2 id="closest-jobs" className="mb-2 font-semibold">Jobs you&apos;re closest to</h2>
        <ul className="divide-y rounded-lg border">
          {jobs.map((j) => (
            <li key={j.id}>
              <button
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => setSelected({ id: `j:${j.id}`, kind: "job", label: j.title, job: j })}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{j.title}</span>
                  <span className="text-muted-foreground">{j.company} · {j.remote ? "Remote" : j.city} · {ago(j.posted_at)}</span>
                </span>
                <Badge variant="secondary" className="tabular-nums">{j.have}/{j.needed} skills</Badge>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {panelJob && <JobPanel job={panelJob} links={links.filter((l) => l.job_id === panelJob.id)} />}
          {panelSkill && (
            <SkillPanel
              node={panelSkill}
              jobs={jobs.filter((j) => links.some((l) => l.job_id === j.id && l.slug === panelSkill.slug))}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function JobPanel({ job, links }: { job: GraphJob; links: GraphLink[] }) {
  const have = links.filter((l) => l.has);
  const missing = links.filter((l) => !l.has);
  return (
    <>
      <SheetHeader>
        <SheetTitle>{job.title}</SheetTitle>
        <SheetDescription>{job.company} · {job.remote ? "Remote in Canada" : job.city} · posted {ago(job.posted_at)}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4">
        <p className="text-sm">You have <strong>{job.have} of {job.needed}</strong> must-have skills.</p>
        <SkillList title="You have" items={have} />
        <SkillList title="Still to learn" items={missing} />
        <a href={job.url} target="_blank" rel="noreferrer" className={buttonVariants()}>Open the job post</a>
      </div>
    </>
  );
}

function SkillPanel({ node, jobs }: { node: Node; jobs: GraphJob[] }) {
  const category = CATEGORIES.find((c) => c.slug === node.category)?.name;
  return (
    <>
      <SheetHeader>
        <SheetTitle>{node.label}</SheetTitle>
        <SheetDescription>{category ?? "Skill"} · {node.has ? "on your resume" : "not on your resume yet"}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4">
        <p className="text-sm">Asked for by {jobs.length} of your closest jobs:</p>
        <ul className="space-y-1 text-sm">
          {jobs.map((j) => <li key={j.id}>{j.title} <span className="text-muted-foreground">· {j.company}</span></li>)}
        </ul>
        {node.slug && <Link href={`/skills/${node.slug}`} className={buttonVariants()}>Who&apos;s hiring, trend &amp; where to learn</Link>}
      </div>
    </>
  );
}

function SkillList({ title, items }: { title: string; items: GraphLink[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((l) => (
          <Link key={l.slug} href={`/skills/${l.slug}`}>
            <Badge variant="outline" className="gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: categoryColor(l.category) }} />
              {l.name}{!l.required && <span className="text-muted-foreground"> · bonus</span>}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-white" />You</span>
      <span className="flex items-center gap-1.5"><span className="size-2 bg-gray-200" />Job</span>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-gray-400" />Skill you have</span>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full border border-gray-400" />Skill to learn</span>
      {CATEGORIES.map((c) => (
        <span key={c.slug} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: c.color }} />{c.name}</span>
      ))}
    </div>
  );
}
