// STUB. Owner: AI (@tomi-alo). Replace with the real version from the tutorial (T3). Keep this signature.
export function canonicalSkill(raw: string): { slug: string; name: string } | null {
  const slug = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? { slug, name: raw.trim() } : null;
}
