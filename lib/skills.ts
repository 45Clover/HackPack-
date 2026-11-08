// Owner: AI (@tomi-alo). Turns the many spellings of a skill ("ReactJS", "React.js")
// into one clean skill, so the database has one row per skill instead of duplicates.

// Known spellings → [slug, display name]. Keys are lowercase and trimmed.
// Add a line here whenever two rows in the `skills` table turn out to be the same skill:
//   select slug, name from skills order by slug;
const ALIASES: Record<string, [slug: string, name: string]> = {
  "react": ["react", "React"], "reactjs": ["react", "React"], "react.js": ["react", "React"],
  "vue": ["vue", "Vue"], "vuejs": ["vue", "Vue"], "vue.js": ["vue", "Vue"],
  "next": ["nextjs", "Next.js"], "nextjs": ["nextjs", "Next.js"], "next.js": ["nextjs", "Next.js"],
  "node": ["nodejs", "Node.js"], "nodejs": ["nodejs", "Node.js"], "node.js": ["nodejs", "Node.js"],
  "express": ["express", "Express"], "expressjs": ["express", "Express"], "express.js": ["express", "Express"],
  "js": ["javascript", "JavaScript"], "javascript": ["javascript", "JavaScript"],
  "ts": ["typescript", "TypeScript"], "typescript": ["typescript", "TypeScript"],
  ".net": [".net", ".NET"], "dotnet": [".net", ".NET"], ".net core": [".net", ".NET"],
  "golang": ["go", "Go"], "go": ["go", "Go"],
  "postgres": ["postgresql", "PostgreSQL"], "postgresql": ["postgresql", "PostgreSQL"],
  "k8s": ["kubernetes", "Kubernetes"], "kubernetes": ["kubernetes", "Kubernetes"],
  "aws": ["aws", "AWS"], "amazon web services": ["aws", "AWS"],
  "gcp": ["google-cloud", "Google Cloud"], "google cloud": ["google-cloud", "Google Cloud"],
  "google cloud platform": ["google-cloud", "Google Cloud"],
  "azure": ["azure", "Azure"], "microsoft azure": ["azure", "Azure"],
  "rest": ["rest-api", "REST APIs"], "rest api": ["rest-api", "REST APIs"], "rest apis": ["rest-api", "REST APIs"],
  "restful apis": ["rest-api", "REST APIs"],
  "ci/cd": ["ci-cd", "CI/CD"], "cicd": ["ci-cd", "CI/CD"],
};

export function canonicalSkill(raw: string): { slug: string; name: string } | null {
  const key = raw.trim().toLowerCase();
  const known = ALIASES[key];
  if (known) {
    const [slug, name] = known;
    return { slug, name };
  }
  // Unknown skill: build a URL-safe slug from the name. Symbols that carry meaning
  // become words first, so "C++" and "C#" don't both collapse to "c".
  const slug = key
    .replace(/\+/g, "plus")
    .replace(/#/g, "sharp")
    .replace(/[^a-z0-9]+/g, "-") // anything else (spaces, dots, slashes) → "-"
    .replace(/^-|-$/g, "");      // no "-" at the start or end
  return slug ? { slug, name: raw.trim() } : null;
}
