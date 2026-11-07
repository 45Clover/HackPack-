"use client";
// The 2D view: a skill tree. You at the root, one branch per category, skills stacked down each branch:
// unlocked (you have it) at the top, then the one you're learning, then locked skills by how many of your jobs want them.
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
};

const PER_BRANCH = 6;
const RANK: Record<State, number> = { have: 0, learning: 1, next: 2, locked: 3 };

export function SkillTree({ skills, have, learning, hidden, jobCount, nextSlug, selectedSlug, onSelect }: Props) {
  const stateOf = (slug: string): State =>
    have.has(slug) ? "have" : learning.has(slug) ? "learning" : slug === nextSlug ? "next" : "locked";

  const branches = CATEGORIES.filter((c) => !hidden.has(c.slug))
    .map((c) => {
      const items = skills
        .filter((s) => s.category === c.slug)
        .sort((a, b) => RANK[stateOf(a.slug)] - RANK[stateOf(b.slug)] || (jobCount.get(b.slug) ?? 0) - (jobCount.get(a.slug) ?? 0));
      return { ...c, items: items.slice(0, PER_BRANCH), more: Math.max(0, items.length - PER_BRANCH) };
    })
    .filter((b) => b.items.length > 0);

  if (branches.length === 0) return <p className="pt-24 text-center text-sm text-muted-foreground">No skills in the categories you picked.</p>;

  return (
    <div className="flex min-w-max flex-col items-center px-6 pb-10">
      {/* Root */}
      <div className="flex flex-col items-center">
        <div className="grid size-14 place-items-center rounded-full bg-[var(--blue)] text-sm font-medium text-white shadow-[0_10px_24px_-10px_var(--blue)]">You</div>
        <div className="h-6 w-px bg-foreground/25" />
      </div>

      {/* Branches: each column draws its piece of the trunk, so the line runs centre-to-centre across them. */}
      <div className="grid grid-flow-col auto-cols-[148px]">
        {branches.map((b, i) => (
          <div key={b.slug} className="relative flex flex-col items-center pt-6">
            <span aria-hidden className={`absolute top-0 h-px bg-foreground/25 ${i === 0 ? "left-1/2 right-0" : i === branches.length - 1 ? "left-0 right-1/2" : "inset-x-0"} ${branches.length === 1 ? "hidden" : ""}`} />
            <span aria-hidden className="absolute top-0 left-1/2 h-6 w-px bg-foreground/25" />
            <p className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] font-medium shadow-[0_1px_2px_rgb(20_20_19/0.06)]">
              <span aria-hidden className="size-2 rounded-full" style={{ background: b.color }} />
              {b.name}
            </p>

            {b.items.map((s, j) => {
              const state = stateOf(s.slug);
              const prev = j === 0 ? "have" : stateOf(b.items[j - 1].slug);
              const solid = state === "have" && prev === "have";
              const n = jobCount.get(s.slug) ?? 0;
              return (
                <div key={s.slug} className="flex flex-col items-center">
                  {/* Connector: solid in the branch colour while you own the path, dashed once it's locked. */}
                  <span
                    aria-hidden
                    className={`h-5 ${solid ? "w-[2px]" : "w-0 border-l-[1.5px] border-dashed border-foreground/25"}`}
                    style={solid ? { background: b.color } : undefined}
                  />
                  <button
                    onClick={() => onSelect(s.slug)}
                    aria-pressed={selectedSlug === s.slug}
                    aria-label={`${s.name}: ${state === "have" ? "you have this" : state === "learning" ? "you're learning this" : state === "next" ? "your next skill" : "locked"}, asked for in ${n} of your closest jobs`}
                    className="group flex w-[132px] flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 transition-colors hover:bg-white/70"
                  >
                    <span
                      className={`grid size-11 place-items-center rounded-full transition-transform group-active:scale-95 ${selectedSlug === s.slug ? "ring-2 ring-foreground ring-offset-2 ring-offset-[#f4f3ef]" : ""} ${
                        state === "have"
                          ? "text-white"
                          : state === "learning"
                            ? "border-2 border-[var(--blue)] bg-[conic-gradient(var(--blue)_0_50%,white_50%_100%)]"
                            : state === "next"
                              ? "border-2 border-dashed border-[var(--blue)] bg-white text-[var(--blue)]"
                              : "border-[1.5px] border-foreground/20 bg-white text-foreground/35"
                      }`}
                      style={state === "have" ? { background: b.color } : undefined}
                    >
                      {state === "have" ? <CheckIcon className="size-5" /> : state === "locked" ? <LockIcon className="size-4" /> : null}
                    </span>
                    <span className={`max-w-full truncate text-[13px] ${state === "locked" ? "text-muted-foreground" : "font-medium"}`}>{s.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {state === "learning" ? "Learning" : state === "next" ? "Next up" : n > 0 ? `in ${n} job${n === 1 ? "" : "s"}` : " "}
                    </span>
                  </button>
                </div>
              );
            })}
            {b.more > 0 && <p className="mt-2 text-[11px] text-muted-foreground">+{b.more} more</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
