"use client";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }); // canvas needs the browser

export type Edge = { company: string; slug: string; skill: string; jobs: number };
type Node = { id: string; label: string; kind: "skill" | "company"; slug?: string; x?: number; y?: number };

export function SkillGraph({ edges }: { edges: Edge[] }) {
  const router = useRouter();
  const data = useMemo(() => {
    const nodes = new Map<string, Node>();
    for (const e of edges) {
      nodes.set(`s:${e.slug}`, { id: `s:${e.slug}`, label: e.skill, kind: "skill", slug: e.slug });
      nodes.set(`c:${e.company}`, { id: `c:${e.company}`, label: e.company, kind: "company" });
    }
    return { nodes: [...nodes.values()], links: edges.map((e) => ({ source: `c:${e.company}`, target: `s:${e.slug}`, value: e.jobs })) };
  }, [edges]);

  if (edges.length === 0) return null;
  // aria-hidden: the table below holds the same data in an accessible form.
  return (
    <div aria-hidden="true" className="surface overflow-hidden">
      <ForceGraph2D
        graphData={data}
        height={520}
        linkWidth={(l) => Math.sqrt((l as { value: number }).value)}
        onNodeClick={(n) => {
          const node = n as Node;
          if (node.kind === "skill") router.push(`/skills/${node.slug}`);
        }}
        nodeCanvasObject={(n, ctx, scale) => {
          const node = n as Node;
          const r = node.kind === "skill" ? 5 : 8;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fillStyle = node.kind === "skill" ? "#2f5bea" : "#1f1f1d";
          ctx.fill();
          ctx.font = `${12 / scale}px sans-serif`;
          ctx.fillStyle = "#2a2a28";
          ctx.fillText(node.label, (node.x ?? 0) + r + 2, (node.y ?? 0) + 4);
        }}
      />
    </div>
  );
}
