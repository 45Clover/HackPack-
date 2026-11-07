"use client";
// The Obsidian-style canvas. Loaded with ssr:false by personal-graph.tsx (canvas needs the browser).
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { categoryColor } from "@/lib/categories";
import type { GraphJob } from "@/lib/dashboard";

export type Node = {
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
export type Link = { source: string | Node; target: string | Node };
const idOf = (end: string | Node) => (typeof end === "string" ? end : end.id);

type Props = { data: { nodes: Node[]; links: Link[] }; width: number; height: number; onSelect: (n: Node) => void };

export default function GraphCanvas({ data, width, height, onSelect }: Props) {
  const fg = useRef<ForceGraphMethods<Node, Link> | undefined>(undefined);
  const [hover, setHover] = useState<string | null>(null);

  // Who touches whom, for hover highlighting and node size.
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

  // Spread the nodes out like Obsidian's graph view.
  useEffect(() => {
    fg.current?.d3Force("charge")?.strength(-110);
    fg.current?.d3Force("link")?.distance(42);
  }, [data]);

  return (
    <ForceGraph2D<Node, Link>
      ref={fg}
      graphData={data}
      width={width}
      height={height}
      backgroundColor="#16161e"
      autoPauseRedraw={false}
      cooldownTicks={150}
      onEngineStop={() => fg.current?.zoomToFit(400, 50)}
      linkColor={(l) => {
        const on = hover && (idOf(l.source) === hover || idOf(l.target) === hover);
        return on ? "rgba(255,255,255,0.55)" : `rgba(255,255,255,${hover ? 0.04 : 0.13})`;
      }}
      onNodeHover={(n) => setHover(n ? n.id : null)}
      onNodeClick={(n) => n.kind !== "me" && onSelect(n)}
      nodeCanvasObject={(node, ctx, scale) => {
        const x = node.x ?? 0, y = node.y ?? 0;
        const degree = neighbours.get(node.id)?.size ?? 1;
        const r = node.kind === "me" ? 8 : node.kind === "job" ? 4 : 2.5 + Math.sqrt(degree);
        const color = node.kind === "me" ? "#ffffff" : node.kind === "job" ? "#e5e7eb" : categoryColor(node.category);
        ctx.globalAlpha = lit(node.id) ? 1 : 0.15;
        ctx.shadowColor = color;
        ctx.shadowBlur = node.kind === "me" || node.id === hover ? 18 : 6;
        ctx.beginPath();
        if (node.kind === "job") ctx.rect(x - r, y - r, r * 2, r * 2); // jobs are squares, skills are dots
        else ctx.arc(x, y, r, 0, 2 * Math.PI);
        if (node.kind === "skill" && !node.has) {
          ctx.strokeStyle = color; // a skill you're missing is a hollow ring
          ctx.lineWidth = 1.5 / scale;
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        // Like Obsidian: labels for you, popular skills, whatever you hover, and everything once you zoom in.
        const show =
          node.kind === "me" ||
          node.id === hover ||
          (!!hover && lit(node.id)) ||
          (node.kind === "skill" && (degree > 5 || scale > 2)) ||
          scale > 3.5;
        if (show) {
          ctx.font = `${11 / scale}px var(--font-geist-sans), sans-serif`;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.textAlign = "center";
          ctx.fillText(node.label.length > 42 ? `${node.label.slice(0, 40)}…` : node.label, x, y + r + 10 / scale);
        }
        ctx.globalAlpha = 1;
      }}
      nodePointerAreaPaint={(node, color, ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, 8, 0, 2 * Math.PI);
        ctx.fill();
      }}
    />
  );
}
