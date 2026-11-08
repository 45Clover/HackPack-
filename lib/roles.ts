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
