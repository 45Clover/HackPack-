"use client";
// /explore's map, behaving like the dashboard's: the orbit layout, click a job or skill to focus it and its
// neighbours (small cards around it, a card with details at the top left), the zoom slider and the category bar.
// It sits in a scrolling page, so the wheel scrolls the page; the slider zooms.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRightIcon, XIcon } from "lucide-react";
import { ago } from "@/lib/ago";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import type { GLink, GNode } from "@/components/dashboard/graph-3d";
import { GraphBoundary } from "@/components/dashboard/graph-boundary";
import { orbitLayout } from "@/components/dashboard/orbit";
import { ZoomControl } from "@/components/dashboard/zoom-control";
import { CategoryBar } from "@/components/dashboard/category-bar";
import { CompanyLogo } from "@/components/dashboard/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ListJob } from "./job-list";

const Graph3D = dynamic(() => import("@/components/dashboard/graph-3d"), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center text-sm text-muted-foreground">Loading the map…</p>,
});
const none = new Set<string>();

export function ExploreMap({ jobs }: { jobs: ListJob[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ width: Math.round(e.contentRect.width), height: Math.round(e.contentRect.height) }));
    ro.observe(box.current!);
    return () => ro.disconnect();
  }, []);

  const [picked, setPicked] = useState<GNode | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(none);
  const [zoom, setZoom] = useState<number | null>(null);
  const onZoom = useCallback((v: number) => setZoom((z) => (z !== null && Math.abs(z - v) < 0.5 ? z : v)), []);

  // Same shape as the dashboard's map, in the orbit layout: skills around a ring by category, jobs inside it.
  const data = useMemo(() => {
    const nodes = new Map<string, GNode>();
    const edges: GLink[] = [];
    for (const j of jobs) {
      nodes.set(`j:${j.id}`, { id: `j:${j.id}`, kind: "job", label: `${j.title} · ${j.company}`, jobId: j.id, title: j.title });
      for (const s of j.skills) {
        if (!nodes.has(`s:${s.slug}`)) nodes.set(`s:${s.slug}`, { id: `s:${s.slug}`, kind: "skill", label: s.name, slug: s.slug, category: s.category });
        edges.push({ source: `j:${j.id}`, target: `s:${s.slug}`, kind: "missing" });
      }
    }
    orbitLayout([...nodes.values()], edges);
    return { nodes: [...nodes.values()], links: edges };
  }, [jobs]);
  // The filters above can take the picked node off the map: then nothing is picked.
  const selected = picked && data.nodes.some((n) => n.id === picked.id) ? picked : null;
  const job = selected?.kind === "job" ? jobs.find((j) => j.id === selected.jobId) : undefined;
  const skillJobs = selected?.kind === "skill" ? jobs.filter((j) => j.skills.some((s) => s.slug === selected.slug)).length : 0;
  const cats = CATEGORIES.filter((c) => data.nodes.some((n) => n.category === c.slug));

  const mini = (n: GNode) => {
    if (n.kind === "job") {
      const j = jobs.find((x) => x.id === n.jobId);
      return (
        <>
          <span className="block truncate font-medium">{j?.title}</span>
          <span className="block truncate text-muted-foreground">{j?.internship && "Internship · "}{j?.company}</span>
        </>
      );
    }
    return (
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(n.category) }} />
        <span className="truncate font-medium">{n.label}</span>
      </span>
    );
  };

  return (
    <div ref={box} className="relative h-full w-full">
      {size.width > 0 && (
        <GraphBoundary>
          <Graph3D
            orbit
            refit
            scrollPage
            fitPoints
            zoom={zoom}
            onZoom={onZoom}
            data={data}
            have={none}
            learning={none}
            hidden={hidden}
            selectedId={selected?.id ?? null}
            onSelect={setPicked}
            hoverId={null}
            mini={mini}
            width={size.width}
            height={size.height}
          />
        </GraphBoundary>
      )}

      {/* What you clicked, like the dashboard's side panel. */}
      {selected && (
        <div className="surface absolute top-4 left-4 z-20 flex w-[min(340px,calc(100%-32px))] flex-col gap-3 p-5">
          <button aria-label="Close" onClick={() => setPicked(null)} className="absolute top-3 right-3 grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
            <XIcon className="size-4" />
          </button>
          {job ? (
            <>
              <CompanyLogo name={job.company} className="size-9" />
              <div className="flex flex-col gap-1 pr-6">
                {job.internship && <Badge variant="secondary" className="w-fit">Internship</Badge>}
                <p className="leading-snug font-semibold tracking-tight">{job.title}</p>
                <p className="text-sm text-muted-foreground">{job.company} · {job.remote ? "Remote in Canada" : job.city ?? "Canada"} · {ago(job.posted_at)}</p>
              </div>
              <p className="text-sm text-muted-foreground">Asks for {job.skills.length} {job.skills.length === 1 ? "skill" : "skills"}: they light up on the map.</p>
              <a href={job.url} target="_blank" rel="noopener" className={buttonVariants({ variant: "secondary", className: "w-fit gap-1.5" })}>
                Open the job post <ArrowUpRightIcon aria-hidden className="size-3.5" />
              </a>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 pr-6 text-lg font-semibold tracking-tight">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: categoryColor(selected.category) }} />
                {selected.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {skillJobs} {skillJobs === 1 ? "job" : "jobs"} on this map {skillJobs === 1 ? "asks" : "ask"} for it.
              </p>
              <Link href={`/skills/${selected.slug}`} className={buttonVariants({ className: "w-fit" })}>Open its learning guide</Link>
            </>
          )}
        </div>
      )}

      <ZoomControl value={zoom ?? 50} onChange={setZoom} className="absolute top-1/2 right-4 lg:right-6" />

      {/* Focus one category, like the dashboard's bottom bar. */}
      <nav aria-label="Focus one category" className="surface absolute bottom-4 left-1/2 z-20 hidden max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-0.5 rounded-full p-1.5 lg:flex">
        <CategoryBar
          cats={[{ slug: "all", label: "All" }, ...cats.map((c) => ({ slug: c.slug, label: c.short, color: c.color }))]}
          active={hidden.size === 0 ? "all" : hidden.size === CATEGORIES.length - 1 ? CATEGORIES.find((c) => !hidden.has(c.slug))?.slug ?? null : null}
          onPick={(slug) => setHidden(slug === "all" ? none : new Set(CATEGORIES.filter((x) => x.slug !== slug).map((x) => x.slug)))}
        />
      </nav>
    </div>
  );
}
