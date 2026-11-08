// The Gemini step for "Impact projects", as plain functions so lib/impact.test.ts can check them
// without calling Gemini or the database. scripts/impact-generate.ts runs them.
import type { CategorySlug } from "../categories";
import type { Dataset, Point } from "./datasets";

export type SnapshotSet = Dataset & { series: Point[] };
export type SkillRow = { id: number; slug: string; name: string; category: string | null };
export type Pair = { skill: SkillRow; dataset: SnapshotSet };
export type Generated = Pair & { problem: string; build: string; practice: string; proof: string };

export const PER_SKILL = 2; // impact projects per skill
export const SKILLS_PER_CALL = 5; // 5 skills x 2 = 10 projects per Gemini call

// Each skill gets PER_SKILL datasets that fit its category. Skills in one category take turns
// through that category's datasets, so Python and TypeScript don't both get the same two.
export function pairSkills(skills: SkillRow[], datasets: SnapshotSet[], perSkill = PER_SKILL): Pair[] {
  const turn = new Map<string, number>();
  return skills.flatMap((skill) => {
    const fit = datasets.filter((d) => d.fits.includes(skill.category as CategorySlug));
    const pool = fit.length > 0 ? fit : datasets; // a skill with no category still gets projects
    const k = turn.get(skill.category ?? "") ?? 0;
    turn.set(skill.category ?? "", k + 1);
    return Array.from({ length: Math.min(perSkill, pool.length) }, (_, i) => ({ skill, dataset: pool[(k * perSkill + i) % pool.length] }));
  });
}

export const IMPACT_SYSTEM_PROMPT = `You write "Impact projects" for students in Canada who are learning a tech skill.
INPUT: a JSON array of tasks. Each task is one skill plus one public dataset: "skill", "dataset" (what it measures), "unit", "source" and "series" (the real data points, oldest first).
For EACH task, write one project a student could build in 2 to 4 weekends that helps the people behind those numbers, while practising the skill.
- "problem": 1 to 2 plain sentences. Quote the first and the last point exactly as given, with their periods (like "from <first value> in <first period> to <last value> in <last period>"). Say where, and who is affected.
- "build": 1 to 2 sentences. What to build, and who it is for.
- "practice": 1 to 2 sentences. How building it uses the skill, specific to that skill.
- "proof": 1 sentence. What to submit to prove it, such as a public repo, a live link, tests or a short demo video.
RULES
- The only numbers you may write are the values and periods in that task's series and the numbers in its dataset title. Never compute a change, a percentage, an average or a total. Never add a number from memory.
- "build", "practice" and "proof" contain no statistics. Small counts and version numbers under 11 are fine.
- Do not promise the project fixes the problem. Say who it helps and how.
- Plain English, short sentences, no em dashes, no hype.
Return every task exactly once, with its "skill_slug" and "dataset_id" copied from the input.`;

const text = { type: "string" };
export const IMPACT_SCHEMA = {
  type: "object",
  properties: {
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: { skill_slug: text, dataset_id: text, problem: text, build: text, practice: text, proof: text },
        required: ["skill_slug", "dataset_id", "problem", "build", "practice", "proof"],
      },
    },
  },
  required: ["projects"],
};

const SOURCE = { statcan: "Statistics Canada", unsdg: "UN SDG database" };

// A JSON array with one task per line, so the --dry-run print is readable.
export const buildImpactInput = (pairs: Pair[]) => `[\n${pairs.map(({ skill, dataset: d }) => JSON.stringify({
  skill_slug: skill.slug, skill: skill.name, dataset_id: d.id, dataset: d.title, unit: d.unit, source: SOURCE[d.source], series: d.series,
})).join(",\n")}\n]`;

// Each number in a text, and whether it's written as a percentage ("28.4%", "28.4 per cent").
const NUM = /(\d[\d,]*(?:\.\d+)?)(\s*(?:%|per ?cent))?/gi;
const numbersIn = (s: string) => [...s.matchAll(NUM)].map((m) => ({ n: Number(m[1].replaceAll(",", "")), pct: Boolean(m[2]) }));

// Every number a project may contain for this dataset: each value (as given, or rounded to 0 or 1
// decimals), the numbers in its periods ("2026 Q2" -> 2026, 2) and the numbers in its title and unit.
export function allowedNumbers(d: SnapshotSet) {
  const values = new Set(d.series.flatMap((p) => [p.value, Math.round(p.value), Math.round(p.value * 10) / 10]));
  const other = [...d.series.map((p) => p.period), d.title, d.unit].flatMap((s) => numbersIn(s).map((x) => x.n));
  return { values, all: new Set([...values, ...other]) };
}

// Why a project must be dropped, or null if it's fine. This is the guardrail behind "real data only":
// the problem quotes at least one real value and has no number from anywhere else. The other texts
// may also use small numbers (under 11, not a percentage) for counts and versions ("3 charts", "WCAG 2.2").
export function rejectReason(g: Generated): string | null {
  const { values, all } = allowedNumbers(g.dataset);
  const nums = numbersIn(g.problem);
  if (!nums.some((x) => values.has(x.n))) return "problem quotes no value from the series";
  const bad = nums.find((x) => !all.has(x.n));
  if (bad) return `problem has ${bad.n}, which is not in the series`;
  for (const field of ["build", "practice", "proof"] as const) {
    const extra = numbersIn(g[field]).find((x) => !all.has(x.n) && (x.n >= 11 || x.pct));
    if (extra) return `${field} has ${extra.n}${extra.pct ? "%" : ""}, which is not in the series`;
  }
  return null;
}

type Answer = { projects?: { skill_slug?: string; dataset_id?: string; problem?: string; build?: string; practice?: string; proof?: string }[] };
const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s*—\s*/g, ", ").trim() : "");

// Never trust model output blindly. Keep a project only if it answers a pair we asked for, once,
// with all four texts filled in, and passes the number check. Everything else is reported, not saved.
export function parseImpactAnswer(pairs: Pair[], raw: string): { kept: Generated[]; dropped: string[] } {
  let parsed: Answer;
  try {
    parsed = JSON.parse(raw) as Answer;
  } catch {
    return { kept: [], dropped: ["the answer was not JSON"] };
  }
  const asked = new Map(pairs.map((p) => [`${p.skill.slug}|${p.dataset.id}`, p]));
  const kept: Generated[] = [];
  const dropped: string[] = [];
  for (const r of Array.isArray(parsed?.projects) ? parsed.projects : []) {
    const key = `${r.skill_slug}|${r.dataset_id}`;
    const pair = asked.get(key);
    if (!pair) { dropped.push(`${key}: not asked for, or a repeat`); continue; }
    asked.delete(key);
    const g: Generated = { ...pair, problem: clean(r.problem), build: clean(r.build), practice: clean(r.practice), proof: clean(r.proof) };
    const why = !(g.problem && g.build && g.practice && g.proof) ? "a text is empty" : rejectReason(g);
    if (why) dropped.push(`${key}: ${why}`);
    else kept.push(g);
  }
  for (const key of asked.keys()) dropped.push(`${key}: missing from the answer`);
  return { kept, dropped };
}
