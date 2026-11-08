// The "orbit" layout for the 3D map: skills sit around a donut, grouped by category, and each job floats inside
// the ring next to the skills it asks for. Positions are pinned (fx/fy/fz), so the force layout leaves them alone.
// shortcut: preview behind ?layout=orbit; move it into the view switch only if Saagii keeps it.
import { CATEGORIES } from "@/lib/categories";
import type { GLink, GNode } from "./graph-3d";

export const ORBIT_R = 300;
const R = ORBIT_R, TUBE = 55;
const INNER = 140, LANE = 55; // the jobs' ring inside the skills' ring, and the gap between its two lanes

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
  // Jobs: each one's natural spot is the average direction of the skills it asks for, but most jobs share the same
  // popular skills, so they piled up on one side. Keep their order around the ring, then space them evenly on an inner
  // ring (two lanes, so neighbouring titles don't collide), turned to sit as close to their natural spots as possible.
  const jobs = nodes
    .filter((n) => n.kind === "job")
    .map((j) => {
      const ts = links.filter((l) => l.source === j.id).map((l) => angle.get(l.target as string)).filter((t): t is number => t !== undefined);
      return { j, t: Math.atan2(ts.reduce((a, x) => a + Math.sin(x), 0), ts.reduce((a, x) => a + Math.cos(x), 0)) }; // circular mean
    })
    .sort((a, b) => a.t - b.t);
  const step = (2 * Math.PI) / Math.max(jobs.length, 1);
  const turn = Math.atan2(jobs.reduce((a, { t }, k) => a + Math.sin(t - k * step), 0), jobs.reduce((a, { t }, k) => a + Math.cos(t - k * step), 0));
  jobs.forEach(({ j }, k) => {
    const t = turn + k * step;
    const r = INNER + (k % 2) * LANE;
    Object.assign(j, { fx: r * Math.cos(t), fy: ((k % 3) - 1) * 20, fz: r * Math.sin(t) });
  });
}
