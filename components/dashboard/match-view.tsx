"use client";
// The "Match" view (from Saagii's canvas): jobs you're close to on the left (60%+ of their must-haves),
// the skills they ask for in the middle (grouped by category), stretch roles on the right, and a line from each job
// to each skill it wants: solid when you have it, dashed when it's a gap. Hover or pick one to light up its lines.
import { useId, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import type { GraphJob, GraphLink } from "@/lib/dashboard";

type Props = {
  jobs: GraphJob[];
  links: GraphLink[];
  have: Set<string>;
  learning: Set<string>;
  matchOf: (jobId: string) => { have: number; needed: number };
  focusId: string | null; // hovered or selected: "j:<id>" or "s:<slug>"
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  scale: number; // the zoom slider
};

const W = 840, ROW = 46, PILL = 30, TOP = 64, SKILLS = 18;
const LEFT_X = 262, MID_L = 340, MID_R = 500, RIGHT_X = 578; // column anchors in px
const BLUE = "#2f5bea", GAP = "#d9611c";
const calm = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

export function MatchView({ jobs, links, have, learning, matchOf, focusId, onHover, onSelect, scale }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const pct = (id: string) => { const m = matchOf(id); return m.needed ? Math.round((m.have / m.needed) * 100) : 0; };
  const reach = jobs.filter((j) => pct(j.id) >= 60);
  const stretch = jobs.filter((j) => pct(j.id) < 60);

  // The skills these jobs ask for most (top 18), grouped by category.
  const count = new Map<string, { slug: string; name: string; category: string | null; n: number }>();
  for (const l of links) {
    const c = count.get(l.slug) ?? { slug: l.slug, name: l.name, category: l.category, n: 0 };
    c.n++;
    count.set(l.slug, c);
  }
  const order: string[] = CATEGORIES.map((c) => c.slug);
  const skills = [...count.values()].sort((a, b) => b.n - a.n).slice(0, SKILLS)
    .sort((a, b) => order.indexOf(a.category ?? "") - order.indexOf(b.category ?? "") || b.n - a.n);
  const skillY = new Map<string, number>();
  let y = TOP, prevCat: string | null | undefined;
  for (const s of skills) {
    if (prevCat !== undefined && s.category !== prevCat) y += 10; // a little air between categories
    skillY.set(s.slug, y);
    prevCat = s.category;
    y += PILL;
  }
  const jobY = (i: number) => TOP + i * ROW;
  const height = Math.max(y, TOP + Math.max(reach.length, stretch.length) * ROW) + 16;

  // One cubic curve per job → skill link, split into the five stroke styles.
  const focusJob = focusId?.startsWith("j:") ? focusId.slice(2) : null;
  const focusSkill = focusId?.startsWith("s:") ? focusId.slice(2) : null;
  const strokes = () => ({ dim: "", gap: "", has: "", hiGap: "", hiHas: "" });
  const paths = { left: strokes(), right: strokes() }; // split by side, so each side's lines can grow on their own
  const side = new Map<string, { x: number; y: number; left: boolean }>([
    ...reach.map((j, i): [string, { x: number; y: number; left: boolean }] => [j.id, { x: LEFT_X + 6, y: jobY(i), left: true }]),
    ...stretch.map((j, i): [string, { x: number; y: number; left: boolean }] => [j.id, { x: RIGHT_X - 6, y: jobY(i), left: false }]),
  ]);
  for (const l of links) {
    const a = side.get(l.job_id), sy = skillY.get(l.slug);
    if (!a || sy === undefined) continue;
    const bx = a.left ? MID_L : MID_R, mid = (a.x + bx) / 2;
    const d = `M${a.x},${a.y} C${mid},${a.y} ${mid},${sy} ${bx},${sy} `;
    const owned = have.has(l.slug);
    const lit = focusJob === l.job_id || focusSkill === l.slug;
    const p = paths[a.left ? "left" : "right"];
    if (focusId && !lit) p.dim += d;
    else if (lit) p[owned ? "hiHas" : "hiGap"] += d;
    else p[owned ? "has" : "gap"] += d;
  }

  // Enter (and again when the jobs change): headings fade in, the job columns slide in from their sides, the skills
  // pop in top to bottom, then the lines grow out of the jobs into the skills, like the tree's branches.
  const clip = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  useGSAP(() => {
    if (!calm()) return;
    gsap.from("[data-head]", { opacity: 0, duration: 0.6, ease: "power2.out" });
    gsap.from("[data-col='left']", { opacity: 0, x: -20, duration: 0.7, stagger: 0.04, delay: 0.05, ease: "power3.out" });
    gsap.from("[data-col='right']", { opacity: 0, x: 20, duration: 0.7, stagger: 0.04, delay: 0.05, ease: "power3.out" });
    gsap.from("[data-col='mid']", { opacity: 0, scale: 0.6, duration: 0.5, stagger: 0.03, delay: 0.2, ease: "power3.out" });
    gsap.from("[data-clip='left']", { attr: { width: 0 }, duration: 0.9, delay: 0.45, ease: "power2.inOut" });
    gsap.from("[data-clip='right']", { attr: { x: RIGHT_X + 24, width: 0 }, duration: 0.9, delay: 0.45, ease: "power2.inOut" });
  }, { scope: root, dependencies: [jobs] });

  const job = (j: GraphJob, i: number, left: boolean) => {
    const p = pct(j.id), m = matchOf(j.id);
    const id = `j:${j.id}`, on = focusJob === j.id;
    return (
      <button
        key={j.id}
        data-col={left ? "left" : "right"}
        onClick={() => onSelect(id)}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(id)}
        onBlur={() => onHover(null)}
        aria-pressed={on}
        aria-label={`${j.title} at ${j.company}: you have ${m.have} of ${m.needed} must-have skills`}
        className={`absolute flex -translate-y-1/2 items-center gap-2.5 rounded-xl p-1 ${left ? "flex-row-reverse text-right" : "text-left"}`}
        style={{ top: jobY(i), ...(left ? { right: W - LEFT_X - 18 } : { left: RIGHT_X - 18 }) }}
      >
        <span aria-hidden className="grid size-[30px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${on ? BLUE : "#1c1c1a"} ${p * 3.6}deg, #e2ded3 0deg)` }}>
          <span className="size-5 rounded-full bg-white" />
        </span>
        <span className="flex max-w-[200px] flex-col">
          <span className={`truncate text-[13px] leading-[18px] font-medium ${on ? "text-[var(--blue)]" : ""}`}>{j.title}</span>
          <span className="truncate text-[11px] leading-4 text-muted-foreground">{j.company} · {p}%</span>
        </span>
      </button>
    );
  };

  return (
    <div ref={root} role="group" aria-label="Jobs and the skills they ask for" className="relative mx-auto shrink-0" style={{ width: W, height, zoom: scale }}>
      <svg aria-hidden className="absolute inset-0 overflow-visible" width={W} height={height}>
        <defs>
          <clipPath id={`${clip}-left`}><rect data-clip="left" x={LEFT_X - 24} y={0} width={MID_L - LEFT_X + 48} height={height} /></clipPath>
          <clipPath id={`${clip}-right`}><rect data-clip="right" x={MID_R - 24} y={0} width={RIGHT_X - MID_R + 48} height={height} /></clipPath>
        </defs>
        {(["left", "right"] as const).map((s) => (
          <g key={s} clipPath={`url(#${clip}-${s})`}>
            <path d={paths[s].dim} fill="none" stroke="#e6e2d8" strokeWidth={1} />
            <path d={paths[s].gap} fill="none" stroke="#c6c1b4" strokeWidth={1.25} strokeDasharray="4 4" />
            <path d={paths[s].has} fill="none" stroke="#a29d91" strokeWidth={1.25} />
            <path d={paths[s].hiGap} fill="none" stroke={GAP} strokeWidth={2} strokeDasharray="5 4" />
            <path d={paths[s].hiHas} fill="none" stroke={BLUE} strokeWidth={2.5} />
          </g>
        ))}
      </svg>

      <ColumnHead x={LEFT_X} align="right" title="Within reach" note="You have 60% or more" />
      <ColumnHead x={(MID_L + MID_R) / 2} align="center" title="Skills" note="Grouped by category" />
      <ColumnHead x={RIGHT_X} align="left" title="Stretch roles" note="You have under 60%" />

      {reach.map((j, i) => job(j, i, true))}
      {stretch.map((j, i) => job(j, i, false))}
      {reach.length === 0 && <p className="absolute text-right text-xs text-muted-foreground" style={{ top: TOP, right: W - LEFT_X }}>None yet. Add skills to get closer.</p>}

      {skills.map((s) => {
        const id = `s:${s.slug}`, on = focusSkill === s.slug;
        const state = have.has(s.slug) ? "have" : learning.has(s.slug) ? "learning" : "missing";
        return (
          <button
            key={s.slug}
            data-col="mid"
            onClick={() => onSelect(id)}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(id)}
            onBlur={() => onHover(null)}
            aria-pressed={on}
            aria-label={`${s.name}: ${state === "have" ? "you have it" : state === "learning" ? "you're learning it" : "to learn"}, in ${s.n} of these jobs`}
            className={`absolute flex h-7 -translate-y-1/2 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors ${
              state === "have" ? "bg-[var(--ink)] text-white" : state === "learning" ? "border border-[var(--ink)] bg-[linear-gradient(90deg,#e8e5dd_50%,#fff_50%)]" : "border border-foreground/20 bg-white"
            } ${on ? "ring-2 ring-[var(--blue)] ring-offset-2 ring-offset-[#f4f3ef]" : ""}`}
            style={{ top: skillY.get(s.slug), left: MID_L, width: MID_R - MID_L }}
          >
            <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: categoryColor(s.category) }} />
            <span className="truncate">{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function ColumnHead({ x, align, title, note }: { x: number; align: "left" | "right" | "center"; title: string; note: string }) {
  const pos = align === "right" ? { right: W - x } : align === "left" ? { left: x } : { left: x, transform: "translateX(-50%)" };
  return (
    <div data-head className="absolute top-2" style={{ ...pos, textAlign: align }}>
      <p className="text-[13px] font-semibold">{title}</p>
      <p className="text-[12px] text-muted-foreground">{note}</p>
    </div>
  );
}
