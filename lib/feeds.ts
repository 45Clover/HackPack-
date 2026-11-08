// Owner: Job data. One function per job board system, all returning the same shape (tutorial T2).

export type Ats = "ashby" | "greenhouse" | "lever";
export type Board = { ats: Ats; board: string };
export type FeedJob = { externalId: string; title: string; location: string; url: string; description: string; postedAt: string };

// shortcut: regex tag strip, fine for reading skills; use a real HTML parser if text comes out garbled.
const strip = (html: string) =>
  html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// 10 s cap per feed, so one slow board can't eat the daily call's time budget.
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

type AshbyJob = { id: string; title: string; location?: string; isRemote?: boolean; isListed?: boolean; jobUrl: string; descriptionPlain?: string; publishedAt?: string };
type GreenhouseJob = { id: number; title: string; location?: { name?: string }; absolute_url: string; content?: string; first_published?: string; updated_at?: string };
type LeverJob = {
  id: string; text: string; hostedUrl: string; createdAt: number; country?: string; workplaceType?: string;
  categories?: { location?: string }; descriptionPlain?: string; additionalPlain?: string; lists?: { text: string; content: string }[];
};

// The feed URL the daily fetch calls for a board.
export function feedUrl(b: Board): string {
  const slug = encodeURIComponent(b.board);
  if (b.ats === "ashby") return `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  if (b.ats === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  return `https://api.lever.co/v0/postings/${slug}?mode=json`;
}

export async function fetchBoard(b: Board): Promise<FeedJob[]> {
  const url = feedUrl(b);
  if (b.ats === "ashby") {
    const d = await getJson<{ jobs: AshbyJob[] }>(url);
    return d.jobs.filter((j) => j.isListed !== false).map((j) => ({
      externalId: j.id, title: j.title, location: [j.location ?? "", j.isRemote ? "Remote" : ""].join(" "),
      url: j.jobUrl, description: j.descriptionPlain ?? "", postedAt: j.publishedAt ?? new Date().toISOString(),
    }));
  }
  if (b.ats === "greenhouse") {
    const d = await getJson<{ jobs: GreenhouseJob[] }>(url);
    return d.jobs.map((j) => ({
      externalId: String(j.id), title: j.title, location: j.location?.name ?? "",
      url: j.absolute_url, description: strip(j.content ?? ""), postedAt: j.first_published ?? j.updated_at ?? new Date().toISOString(),
    }));
  }
  const d = await getJson<LeverJob[]>(url);
  return d.map((j) => ({
    externalId: j.id, title: j.text, location: `${j.categories?.location ?? ""} ${j.country ?? ""} ${j.workplaceType ?? ""}`,
    url: j.hostedUrl, postedAt: new Date(j.createdAt).toISOString(),
    description: [j.descriptionPlain, ...(j.lists ?? []).map((l) => `${l.text}: ${strip(l.content)}`), j.additionalPlain].join("\n"),
  }));
}

// shortcut: keyword filter on the title; widen it if good jobs are missing. Location is checked by parseLocation.
const TECH = /engineer|developer|software|data|devops|sre|security|qa|test|analyst|architect|machine learning|\bml\b|\bai\b|cloud|platform|full.?stack|front.?end|back.?end|mobile|ios|android|product designer/i;
export const isTech = (j: FeedJob) => TECH.test(j.title);
