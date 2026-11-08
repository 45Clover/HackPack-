// The "orbit" layout for the 3D map: skills sit around a donut, grouped by category, and each job floats inside
// the ring next to the skills it asks for. Positions are pinned (fx/fy/fz), so the force layout leaves them alone.
// shortcut: preview behind ?layout=orbit; move it into the view switch only if Saagii keeps it.
import { CATEGORIES } from "@/lib/categories";
import type { GLink, GNode } from "./graph-3d";

export const ORBIT_R = 300;
const R = ORBIT_R, TUBE = 55;

export function orbitLayout(nodes: GNode[], links: GLink[]) {
  const order: string[] = CATEGORIES.map((c) => c.slug);
  const skills = nodes
    .filter((n) => n.kind === "skill")
    .sort((a, b) => order.indexOf(a.category ?? "") - order.indexOf(b.category ?? "") || a.label.localeCompare(b.label));
  const angle = new Map<string, number>();
  skills.forEach((n, i) => {
    const t = (i / skills.length) * 2 * Math.PI;
    const phi = i * 2.39996; // golden angle: spreads skills around the tube's thickness
    const r = R + TUBE * Math.cos(phi);
    Object.assign(n, { fx: r * Math.cos(t), fy: TUBE * Math.sin(phi), fz: r * Math.sin(t) });
    angle.set(n.id, t);
  });
  nodes.filter((n) => n.kind === "job").forEach((j, k) => {
    const ts = links.filter((l) => l.source === j.id).map((l) => angle.get(l.target as string)).filter((t): t is number => t !== undefined);
    const t = Math.atan2(ts.reduce((s, x) => s + Math.sin(x), 0), ts.reduce((s, x) => s + Math.cos(x), 0)); // circular mean
    const r = 140 + (k % 3) * 35;
    Object.assign(j, { fx: r * Math.cos(t), fy: ((k % 5) - 2) * 18, fz: r * Math.sin(t) });
  });
}
