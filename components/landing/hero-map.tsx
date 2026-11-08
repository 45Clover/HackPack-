"use client";
// The landing hero's right side: the real 3D map (the guest's 15 newest jobs and their skills), turning slowly.
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphJob, GraphLink } from "@/lib/dashboard";
import type { GLink, GNode } from "@/components/dashboard/graph-3d";
import { cn } from "cn";
import { GraphBoundary } from "@/components/dashboard/graph-boundary";

const Graph3D = dynamic(() => import("@/components/dashboard/graph-3d"), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center text-sm text-muted-foreground">Loading the live map…</p>,
});
const none = new Set<string>();
const noop = () => {};

// `className` overrides the frame, e.g. /explore's full-screen map with a softer edge fade.
export function HeroMap({ jobs, links, className, refit }: { jobs: GraphJob[]; links: GraphLink[]; className?: string; refit?: boolean }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => setSize({ width: Math.round(e.contentRect.width), height: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Same shape as the dashboard's map (dashboard-shell.tsx): job nodes, skill nodes, one link per skill a job asks for.
  const data = useMemo(() => {
    const nodes = new Map<string, GNode>();
    const edges: GLink[] = [];
    for (const j of jobs) nodes.set(`j:${j.id}`, { id: `j:${j.id}`, kind: "job", label: `${j.title} · ${j.company}`, jobId: j.id, title: j.title });
    for (const l of links) {
      if (!nodes.has(`s:${l.slug}`)) nodes.set(`s:${l.slug}`, { id: `s:${l.slug}`, kind: "skill", label: l.name, slug: l.slug, category: l.category });
      edges.push({ source: `j:${l.job_id}`, target: `s:${l.slug}`, kind: l.has ? "has" : "missing" });
    }
    return { nodes: [...nodes.values()], links: edges };
  }, [jobs, links]);

  return (
    // Phones: the map is a picture (touch would trap the page scroll). Desktop: drag to turn it; the wheel still scrolls the page.
    <div
      ref={box}
      // The map has no box of its own: its edges fade out into the hero's shader gradient.
      className={cn("pointer-events-none relative h-full w-full overflow-hidden [mask-image:radial-gradient(closest-side,black_70%,transparent)] lg:pointer-events-auto", className)}
    >
      {size.width > 0 && (
        <GraphBoundary>
          <Graph3D
            autoRotate
            refit={refit}
            zoom={null}
            onZoom={noop}
            data={data}
            have={none}
            learning={none}
            hidden={none}
            selectedId={null}
            onSelect={(n) => n?.slug && router.push(`/skills/${n.slug}`)}
            onHover={(n) => n?.slug && router.prefetch(`/skills/${n.slug}`)} // the drawer opens on click
            hoverId={null}
            mini={() => null}
            width={size.width}
            height={size.height}
          />
        </GraphBoundary>
      )}
    </div>
  );
}
