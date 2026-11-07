// Seed Neon with REAL job posts from public company feeds, so the app has data before n8n + Gemini run.
// Skills here are matched by keyword (the category hints), not Gemini. Jobs stay `extracted = false`, so
// Tomi's /api/extract still reads every one; it should replace a job's keyword skills when it does.
// Run: npx tsx --env-file=.env.local scripts/seed-from-feeds.ts
import postgres from "postgres";
import { CATEGORIES } from "../lib/categories";
import { parseLocation } from "../lib/location";
import { matchSkills } from "../lib/resume";

type Board = { name: string; ats: "ashby" | "greenhouse" | "lever"; board: string };
const BOARDS: Board[] = [
  { name: "Benevity", ats: "ashby", board: "benevity" },
  { name: "Neo Financial", ats: "ashby", board: "neofinancial" },
  { name: "Jobber", ats: "ashby", board: "jobber" },
  { name: "Cohere", ats: "ashby", board: "cohere" },
  { name: "Wealthsimple", ats: "ashby", board: "wealthsimple" },
  { name: "1Password", ats: "ashby", board: "1password" },
  { name: "Float", ats: "ashby", board: "float" },
  { name: "Hopper", ats: "ashby", board: "hopper" },
  { name: "Trulioo", ats: "ashby", board: "trulioo" },
  { name: "Loopio", ats: "ashby", board: "loopio" },
  { name: "Lightspeed", ats: "ashby", board: "lightspeedhq" },
  { name: "Hootsuite", ats: "greenhouse", board: "hootsuite" },
  { name: "Clutch", ats: "greenhouse", board: "clutch" },
  { name: "Faire", ats: "greenhouse", board: "faire" },
  { name: "PolicyMe", ats: "lever", board: "policyme" },
];
const TECH = /engineer|developer|software|data|devops|sre|security|qa|analyst|architect|machine learning|\bml\b|cloud|platform|full.?stack|front.?end|back.?end|mobile|ios|android/i;
const DICT = CATEGORIES.flatMap((c) =>
  c.hint.split(":")[1].split(",").map((n) => ({ name: n.trim(), slug: n.trim().toLowerCase().replace(/\+/g, "plus").replace(/#/g, "sharp").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), category: c.slug as string })),
);
const strip = (h: string) => h.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
type Job = { id: string; title: string; location: string; url: string; description: string; postedAt: string };

async function fetchBoard(b: Board): Promise<Job[]> {
  const get = async (u: string) => (await fetch(u)).json();
  if (b.ats === "ashby") {
    const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${b.board}`);
    return d.jobs.filter((j: { isListed: boolean }) => j.isListed).map((j: Record<string, string & boolean>) => ({ id: j.id, title: j.title, location: `${j.location} ${j.isRemote ? "Remote" : ""}`, url: j.jobUrl, description: j.descriptionPlain ?? "", postedAt: j.publishedAt }));
  }
  if (b.ats === "greenhouse") {
    const d = await get(`https://boards-api.greenhouse.io/v1/boards/${b.board}/jobs?content=true`);
    return d.jobs.map((j: Record<string, never>) => ({ id: String(j.id), title: j.title, location: (j.location as { name?: string })?.name ?? "", url: j.absolute_url, description: strip(j.content ?? ""), postedAt: j.first_published ?? j.updated_at }));
  }
  const d = await get(`https://api.lever.co/v0/postings/${b.board}?mode=json`);
  return d.map((j: Record<string, never>) => ({ id: j.id, title: j.text, location: `${(j.categories as { location?: string })?.location ?? ""} ${j.country ?? ""} ${j.workplaceType ?? ""}`, url: j.hostedUrl, description: `${j.descriptionPlain ?? ""} ${j.additionalPlain ?? ""}`, postedAt: new Date(j.createdAt).toISOString() }));
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", prepare: false, max: 1 });
  let jobs = 0, links = 0;
  for (const b of BOARDS) {
    let feed: Job[];
    try { feed = await fetchBoard(b); } catch (e) { console.error(b.board, e); continue; }
    const [company] = await sql`insert into companies (name, ats, board) values (${b.name}, ${b.ats}, ${b.board})
      on conflict (ats, board) do update set name = excluded.name returning id`;
    for (const j of feed) {
      const loc = parseLocation(j.location);
      if (!TECH.test(j.title) || !loc.canada) continue;
      const id = `${b.ats}:${b.board}:${j.id}`;
      await sql`insert into jobs (id, company_id, title, location, city, remote, url, description, posted_at)
        values (${id}, ${company.id}, ${j.title}, ${j.location.trim()}, ${loc.city}, ${loc.remote}, ${j.url}, ${j.description}, ${j.postedAt})
        on conflict (id) do nothing`;
      jobs++;
      for (const s of matchSkills(`${j.title}\n${j.description}`, DICT)) {
        const [skill] = await sql`insert into skills (slug, name, category) values (${s.slug}, ${s.name}, ${s.category})
          on conflict (slug) do update set slug = excluded.slug returning id`;
        await sql`insert into job_skills (job_id, skill_id, posted_at) values (${id}, ${skill.id}, ${j.postedAt}) on conflict do nothing`;
        links++;
      }
    }
    console.log(`${b.name}: done`);
  }
  console.log({ jobs, links });
  await sql.end();
}
main();
