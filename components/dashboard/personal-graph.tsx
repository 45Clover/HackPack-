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

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }); // canvas needs the browser

type Node = {
  id: string;
  kind: "me" | "skill" | "job";
  label: string;
  has?: boolean;
  slug?: string;
  category?: string | null;
  job?: GraphJob;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};
type Link = { source: string | Node; target: string | Node };
const idOf = (end: string | Node) => (typeof end === "string" ? end : end.id);

// You → your skills → the jobs you're closest to → the skills those jobs still need.
export function PersonalGraph({ mine, jobs, links }: { mine: MySkill[]; jobs: GraphJob[]; links: GraphLink[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const nodes = new Map<string, Node>([["me", { id: "me", kind: "me", label: "You", fx: 0, fy: 0 }]]);
    const edges: Link[] = [];
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

  // Who touches whom, for hover highlighting.
  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of data.links) {
      const a = idOf(l.source), b = idOf(l.target);
      (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
      (m.get(b) ?? m.set(b, new Set()).get(b)!).add(a);
    }
    return m;
  }, [data]);
  const lit = (id: string) => !hover || id === hover || !!neighbours.get(hover)?.has(id);

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
          <ForceGraph2D
            graphData={data}
            width={width}
            height={560}
            backgroundColor="#16161e"
            autoPauseRedraw={false}
            cooldownTicks={120}
            linkColor={(l) => {
              const link = l as Link;
              const on = hover && (idOf(link.source) === hover || idOf(link.target) === hover);
              return on ? "rgba(255,255,255,0.55)" : `rgba(255,255,255,${hover ? 0.04 : 0.12})`;
            }}
            onNodeHover={(n) => setHover(n ? (n as Node).id : null)}
            onNodeClick={(n) => (n as Node).kind !== "me" && setSelected(n as Node)}
            nodeCanvasObject={(n, ctx, scale) => {
              const node = n as Node;
              const x = node.x ?? 0, y = node.y ?? 0;
              const degree = neighbours.get(node.id)?.size ?? 1;
              const r = node.kind === "me" ? 8 : node.kind === "job" ? 4 : 2.5 + Math.sqrt(degree);
              const color = node.kind === "me" ? "#ffffff" : node.kind === "job" ? "#e5e7eb" : categoryColor(node.category);
              ctx.globalAlpha = lit(node.id) ? 1 : 0.15;
              ctx.shadowColor = color;
              ctx.shadowBlur = node.kind === "me" || node.id === hover ? 16 : 6;
              ctx.beginPath();
              if (node.kind === "job") ctx.rect(x - r, y - r, r * 2, r * 2); // jobs are squares, skills are dots
              else ctx.arc(x, y, r, 0, 2 * Math.PI);
              if (node.kind === "skill" && !node.has) {
                ctx.strokeStyle = color; // missing skills: hollow ring
                ctx.lineWidth = 1.5 / scale;
                ctx.stroke();
              } else {
                ctx.fillStyle = color;
                ctx.fill();
              }
              ctx.shadowBlur = 0;
              // Labels appear when you zoom in, hover, or for the big nodes, like Obsidian.
              if (scale > 1.6 || node.kind === "me" || (hover && lit(node.id)) || degree > 4) {
                ctx.font = `${11 / scale}px var(--font-geist-sans), sans-serif`;
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.textAlign = "center";
                ctx.fillText(node.label.length > 40 ? `${node.label.slice(0, 38)}…` : node.label, x, y + r + 10 / scale);
              }
              ctx.globalAlpha = 1;
            }}
            nodePointerAreaPaint={(n, color, ctx) => {
              const node = n as Node;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, 8, 0, 2 * Math.PI);
              ctx.fill();
            }}
          />
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
