// STUB. Owner: AI (@tomi-alo). Replace with the real version from the tutorial (T7). Keep these signatures.
export type Extras = {
  resources: { title: string; url: string }[];
  projects: { title: string; summary: string; uses: string[] }[];
  adzuna_count: number | null;
};

export async function getExtras(skill: { id: number; name: string }): Promise<Extras> {
  void skill;
  return { resources: [], projects: [], adzuna_count: null };
}
