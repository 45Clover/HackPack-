// "Impact projects" on a skill's Learning guide: a real Canadian problem from public data, and a project
// that helps with it while practising the skill. Written ahead of time by scripts/impact-generate.ts,
// so a page view never calls Gemini.
import { sql } from "../db";
import type { Point } from "./datasets";

export type ImpactProject = {
  id: number;
  source: "statcan" | "unsdg";
  dataset_id: string; // StatCan table number or SDG indicator, e.g. "14-10-0441-01", "8.6.1"
  dataset_title: string;
  dataset_url: string;
  unit: string;
  series: Point[]; // the real points the text quotes, oldest first
  problem: string;
  build: string;
  practice: string;
  proof: string;
  sdg_goal: string | null;
};

export async function getImpactProjects(skillId: number): Promise<ImpactProject[]> {
  try {
    const rows = await sql<ImpactProject[]>`
      select id, source, dataset_id, dataset_title, dataset_url, unit, series, problem, build, practice, proof, sdg_goal
      from impact_projects where skill_id = ${skillId} order by id limit 2`;
    return [...rows]; // a plain array, so it can go straight to a client component
  } catch (e) {
    // 42P01 = table missing: db/008 isn't applied yet, so the page just shows no impact projects.
    if ((e as { code?: string }).code === "42P01") return [];
    throw e;
  }
}
