// Target roles a student can pick in onboarding. `titles` is a Postgres regex matched against job titles.
export const ROLES = [
  { slug: "any", name: "Any tech role", titles: "" },
  { slug: "frontend", name: "Frontend developer", titles: "front.?end|ui engineer|web developer" },
  { slug: "backend", name: "Backend developer", titles: "back.?end|api|server" },
  { slug: "fullstack", name: "Full-stack developer", titles: "full.?stack" },
  { slug: "data-analyst", name: "Data analyst", titles: "analyst|analytics|business intelligence" },
  { slug: "data-engineer", name: "Data engineer", titles: "data engineer|data platform|etl" },
  { slug: "ml", name: "ML / AI engineer", titles: "machine learning|\\mml\\M|\\mai\\M|data scientist" },
  { slug: "devops", name: "DevOps / cloud", titles: "devops|sre|site reliability|cloud|infrastructure|platform" },
  { slug: "mobile", name: "Mobile developer", titles: "mobile|ios|android" },
  { slug: "qa", name: "QA / testing", titles: "\\mqa\\M|test|quality" },
  { slug: "security", name: "Security", titles: "security" },
] as const;

export const roleBySlug = (slug: string | null | undefined) => ROLES.find((r) => r.slug === slug) ?? ROLES[0];
// ?role=… from the URL (the dashboard's role filter), if it's a real role; otherwise the fallback (the saved one).
export const roleFrom = (v: unknown, fallback: string | null) => (typeof v === "string" && ROLES.some((r) => r.slug === v) ? v : fallback);

// What a student is looking for (profiles.looking_for, db/009) and the dashboard's job-type filter (?type=).
export const LOOKING_FOR = [
  { value: "internship", label: "Internship or co-op" },
  { value: "full_time", label: "Full-time job" },
  { value: "both", label: "Both" },
] as const;
export type LookingFor = (typeof LOOKING_FOR)[number]["value"];
export const lookingForFrom = (v: unknown): LookingFor => (LOOKING_FOR.some((l) => l.value === v) ? (v as LookingFor) : "both");

export const JOB_TYPES = [
  { value: "all", label: "All jobs" },
  { value: "internship", label: "Internships" },
  { value: "full_time", label: "Full-time" },
] as const;
export type JobType = (typeof JOB_TYPES)[number]["value"];
// ?type= wins; otherwise what you're looking for ("both" = all jobs).
export const jobTypeFrom = (v: unknown, lookingFor?: string | null): JobType => {
  const t = typeof v === "string" ? v : lookingFor;
  return t === "internship" || t === "full_time" ? t : "all";
};
