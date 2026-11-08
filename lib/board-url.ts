// Owner: Job data. Turns a job-board URL into the board it belongs to:
// jobs.ashbyhq.com/benevity/1234 → { ats: "ashby", board: "benevity" }. Anything else → null.
import type { Ats, Board } from "./feeds";

// Hosts discovery searches. Common Crawl takes them one at a time; Keenable uses them in site: queries.
export const BOARD_HOSTS: { ats: Ats; host: string }[] = [
  { ats: "ashby", host: "jobs.ashbyhq.com" },
  { ats: "greenhouse", host: "job-boards.greenhouse.io" },
  { ats: "greenhouse", host: "boards.greenhouse.io" },
  { ats: "lever", host: "jobs.lever.co" },
];

// Path words that are never a company slug.
const NOT_A_BOARD = new Set(["embed", "api", "jobs", "job_app", "job_board", "robots.txt", "sitemap.xml", "favicon.ico"]);

export function boardFromUrl(raw: string): Board | null {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const p = u.pathname.split("/").filter(Boolean);

  let ats: Ats | null = null;
  let slug: string | null | undefined;
  if (host === "jobs.ashbyhq.com") [ats, slug] = ["ashby", p[0]];
  else if (host === "api.ashbyhq.com" && p[0] === "posting-api" && p[1] === "job-board") [ats, slug] = ["ashby", p[2]];
  else if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io")
    [ats, slug] = ["greenhouse", p[0] === "embed" ? u.searchParams.get("for") : p[0]];
  else if (host === "boards-api.greenhouse.io" && p[0] === "v1" && p[1] === "boards") [ats, slug] = ["greenhouse", p[2]];
  else if (host === "jobs.lever.co") [ats, slug] = ["lever", p[0]];
  else if (host === "api.lever.co" && p[0] === "v0" && p[1] === "postings") [ats, slug] = ["lever", p[2]];

  slug = slug?.trim().toLowerCase();
  if (!ats || !slug || NOT_A_BOARD.has(slug) || slug.length > 80 || !/^[a-z0-9][a-z0-9._-]*$/.test(slug)) return null;
  return { ats, board: slug };
}
