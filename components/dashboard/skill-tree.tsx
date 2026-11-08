"use client";
// The 2D view: a diagonal skill tree, like a game talent tree. You sit bottom-left, a rail runs along the bottom,
// and each category branch climbs up-right at 45°: unlocked skills first, then the one you're learning,
// then locked skills by how many of your jobs want them.
// Motion (GSAP): branches grow out of the rail when they appear and pull back into it when a category filter
// hides them; the branches that stay slide to their new place.
import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CheckIcon, LockIcon } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

type Skill = { id: number; slug: string; name: string; category: string | null };
type State = "have" | "learning" | "next" | "locked";
type Props = {
  skills: Skill[];
  have: Set<string>;
  learning: Set<string>;
  hidden: Set<string>;
  jobCount: Map<string, number>; // how many of your closest jobs ask for each skill
  nextSlug: string | null;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  scale: number; // the zoom slider
};
type Branch = { slug: string; name: string; color: string; items: Skill[]; more: number };

const PER_BRANCH = 6;
const RANK: Record<State, number> = { have: 0, learning: 1, next: 2, locked: 3 };
// Layout in px. STEP = one node up-right; GAP = space between branches (fits a label before the next branch).
const STEP = 64, GAP = 150, PAD = 32, TOP = 56;
const RAIL_Y = TOP + PER_BRANCH * STEP;
const YOU = { x: PAD + 28, y: RAIL_Y + 64 };
const RAIL_X = YOU.x + 64; // the trunk climbs from You to here at 45°
const rootX = (i: number) => RAIL_X + 64 + i * GAP;
const node = (j: number) => ({ x: (j + 1) * STEP, y: RAIL_Y - (j + 1) * STEP }); // relative to the branch root
const LINE = "rgb(20 20 19 / 0.25)";
const calm = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

export function SkillTree({ skills, have, learning, hidden, jobCount, nextSlug, selectedSlug, onSelect, scale }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<SVGLineElement>(null);
  const stateOf = (slug: string): State =>
    have.has(slug) ? "have" : learning.has(slug) ? "learning" : slug === nextSlug ? "next" : "locked";

  const all: Branch[] = CATEGORIES.map((c) => {
    const items = skills
      .filter((s) => s.category === c.slug)
      .sort((a, b) => RANK[stateOf(a.slug)] - RANK[stateOf(b.slug)] || (jobCount.get(b.slug) ?? 0) - (jobCount.get(a.slug) ?? 0));
    return { slug: c.slug, name: c.name, color: c.color, items: items.slice(0, PER_BRANCH), more: Math.max(0, items.length - PER_BRANCH) };
  }).filter((b) => b.items.length > 0);
  const visible = all.filter((b) => !hidden.has(b.slug));

  // Branches a filter just hid stay on screen until they've pulled back in (React's "previous render" pattern).
  const key = visible.map((b) => b.slug).join();
  const [prevKey, setPrevKey] = useState(key);
  const [leaving, setLeaving] = useState<string[]>([]);
  if (prevKey !== key) {
    setPrevKey(key);
    const gone = prevKey.split(",").filter((s) => s && !key.split(",").includes(s));
    setLeaving((l) => [...new Set([...l, ...gone])].filter((s) => !key.split(",").includes(s)));
  }
  const shown = all.filter((b) => !hidden.has(b.slug) || leaving.includes(b.slug));

  // Pull the leaving branches back in, tip first, then drop them.
  useLayoutEffect(() => {
    if (!leaving.length || !root.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => setLeaving([]) });
      for (const slug of leaving) {
        const sel = <T extends Element>(s: string) => [...root.current!.querySelectorAll<T>(`[data-branch="${slug}"] ${s}`)].reverse();
        tl.to(sel("[data-node]"), { opacity: 0, scale: 0.5, duration: 0.3, stagger: 0.04, ease: "power2.in" }, 0);
        sel<SVGLineElement>("line").forEach((l, k) => tl.to(l, { attr: { x2: l.x1.baseVal.value, y2: l.y1.baseVal.value }, duration: 0.3, ease: "power2.in" }, 0.05 + k * 0.04));
        tl.to(sel("[data-pill]"), { opacity: 0, y: 6, duration: 0.25 }, 0.3);
      }
      if (!calm()) tl.progress(1); // reduced motion: skip straight to the end
    }, root);
    return () => ctx.revert(); // a branch that comes back mid-way returns to full size
  }, [leaving]);

  // The rail stretches or shrinks to the last branch.
  const railEnd = rootX(Math.max(shown.length - 1, 0));
  const lastRailEnd = useRef(railEnd);
  useLayoutEffect(() => {
    if (rail.current && calm()) gsap.fromTo(rail.current, { attr: { x2: lastRailEnd.current } }, { attr: { x2: railEnd }, duration: 0.6, ease: "power3.out" });
    lastRailEnd.current = railEnd;
  }, [railEnd]);

  if (all.length === 0) return <p className="pb-24 text-center text-sm text-muted-foreground">No skills yet.</p>;

  const width = rootX(Math.max(shown.length - 1, 0)) + PER_BRANCH * STEP + 140 + PAD;
  const height = YOU.y + 28 + PAD;

  return (
    <div ref={root} role="group" aria-label="Skill tree" className="relative mx-auto shrink-0" style={{ width, height, zoom: scale }}>
      <svg aria-hidden className="absolute inset-0 overflow-visible" width={width} height={height}>
        <line x1={YOU.x} y1={YOU.y} x2={RAIL_X} y2={RAIL_Y} stroke={LINE} strokeWidth={1.5} />
        <line ref={rail} x1={RAIL_X} y1={RAIL_Y} x2={railEnd} y2={RAIL_Y} stroke={LINE} strokeWidth={1.5} />
      </svg>

      <div className="absolute grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--blue)] text-sm font-medium text-white shadow-[0_10px_24px_-10px_var(--blue)]" style={{ left: YOU.x, top: YOU.y }}>
        You
      </div>

      {shown.map((b, i) => (
        <BranchView key={b.slug} branch={b} left={rootX(i)} order={i} height={height} stateOf={stateOf} jobCount={jobCount} selectedSlug={selectedSlug} onSelect={onSelect} />
      ))}
      {visible.length === 0 && leaving.length === 0 && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted-foreground">No skills in the categories you picked.</p>}
    </div>
  );
}

function BranchView({ branch: b, left, order, height, stateOf, jobCount, selectedSlug, onSelect }: {
  branch: Branch; left: number; order: number; height: number; stateOf: (slug: string) => State;
  jobCount: Map<string, number>; selectedSlug: string | null; onSelect: (slug: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);

  // Grow out of the rail when this branch appears: the pill, then each segment and node from root to tip.
  useGSAP(() => {
    if (!calm()) return;
    const base = 0.1 + order * 0.06;
    gsap.from("[data-pill]", { opacity: 0, y: 6, duration: 0.5, delay: base, ease: "power3.out" });
    el.current!.querySelectorAll("line").forEach((l, k) =>
      gsap.from(l, { attr: { x2: l.x1.baseVal.value, y2: l.y1.baseVal.value }, duration: 0.45, delay: base + 0.1 + k * 0.09, ease: "power2.out" }));
    gsap.from("[data-node]", { opacity: 0, scale: 0.5, duration: 0.5, stagger: 0.09, delay: base + 0.25, ease: "power3.out" });
  }, { scope: el });

  // When branches before it leave or come back, slide to the new place instead of jumping.
  const lastLeft = useRef(left);
  useLayoutEffect(() => {
    if (lastLeft.current !== left && el.current && calm()) gsap.fromTo(el.current, { x: lastLeft.current - left }, { x: 0, duration: 0.6, ease: "power3.out" });
    lastLeft.current = left;
  }, [left]);

  return (
    <div ref={el} data-branch={b.slug} className="absolute top-0" style={{ left, height }}>
      <svg aria-hidden className="absolute top-0 left-0 overflow-visible" width={1} height={height}>
        {b.items.map((s, j) => {
          const from = j === 0 ? { x: 0, y: RAIL_Y } : node(j - 1);
          const to = node(j);
          // Solid in the branch colour while you own the path, dashed once it's locked.
          const solid = stateOf(s.slug) === "have" && (j === 0 || stateOf(b.items[j - 1].slug) === "have");
          return (
            <line
              key={s.slug}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={solid ? b.color : LINE}
              strokeWidth={solid ? 2.5 : 1.5}
              strokeDasharray={solid ? undefined : "4 5"}
            />
          );
        })}
      </svg>

      <p data-pill className="absolute flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] font-medium whitespace-nowrap shadow-[0_1px_2px_rgb(20_20_19/0.06)]" style={{ left: 0, top: RAIL_Y + 12 }}>
        <span aria-hidden className="size-2 rounded-full" style={{ background: b.color }} />
        {b.name}
      </p>

      {b.items.map((s, j) => {
        const { x, y } = node(j);
        const state = stateOf(s.slug);
        const n = jobCount.get(s.slug) ?? 0;
        return (
          <button
            key={s.slug}
            data-node
            onClick={() => onSelect(s.slug)}
            aria-pressed={selectedSlug === s.slug}
            aria-label={`${s.name}: ${state === "have" ? "you have this" : state === "learning" ? "you're learning this" : state === "next" ? "your next skill" : "locked"}, asked for in ${n} of your closest jobs`}
            className="group absolute flex h-10 w-max origin-[20px_20px] items-center gap-2 rounded-xl pr-2 text-left transition-colors hover:bg-white/70"
            style={{ left: x - 20, top: y - 20 }}
          >
            <span className="grid size-10 shrink-0 place-items-center">
              <span
                className={`grid size-7 rotate-45 place-items-center rounded-[6px] transition-transform group-active:scale-95 ${selectedSlug === s.slug ? "ring-2 ring-foreground ring-offset-2 ring-offset-[#f4f3ef]" : ""} ${
                  state === "have"
                    ? "text-white"
                    : state === "learning"
                      ? "border-2 border-[var(--blue)] bg-[conic-gradient(var(--blue)_0_50%,white_50%_100%)]"
                      : state === "next"
                        ? "border-2 border-dashed border-[var(--blue)] bg-white"
                        : "border-[1.5px] border-foreground/20 bg-white text-foreground/35"
                }`}
                style={state === "have" ? { background: b.color } : undefined}
              >
                <span className="-rotate-45">
                  {state === "have" ? <CheckIcon className="size-4" /> : state === "locked" ? <LockIcon className="size-3" /> : null}
                </span>
              </span>
            </span>
            <span className="flex max-w-[104px] flex-col leading-tight">
              <span className={`truncate text-[13px] ${state === "locked" ? "text-muted-foreground" : "font-medium"}`}>{s.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {state === "learning" ? "Learning" : state === "next" ? "Next up" : n > 0 ? `in ${n} job${n === 1 ? "" : "s"}` : " "}
              </span>
            </span>
          </button>
        );
      })}
      {b.more > 0 && (() => {
        const top = node(b.items.length - 1);
        return <p data-node className="absolute text-[11px] whitespace-nowrap text-muted-foreground" style={{ left: top.x + 10, top: top.y - 40 }}>+{b.more} more</p>;
      })()}
    </div>
  );
}
