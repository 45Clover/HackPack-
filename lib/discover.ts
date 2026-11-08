// Owner: Job data. Path 1, discovery: find new company boards and add them to the boards table.
// Two sources on their own schedules (lib/schedule.ts). Each run is split into small steps and saves where it
// stopped after every step, so a run can span several daily calls, and a failure only pauses discovery.
// The daily fetch never waits on this.
import { sql } from "./db";
import { fetchBoard, isTech, type Board } from "./feeds";
import { parseLocation } from "./location";
import { pool } from "./pool";
import { BOARD_HOSTS, boardFromUrl } from "./board-url";
import { isDue, isUnfinished, nextRunAt, type RunRow, type Source } from "./schedule";

type State = Record<string, unknown>;
type Step = (state: State, until: number) => Promise<{ state: State; done: boolean; found: Board[] }>;

const UA = { "User-Agent": "HackPack job-skills map (Hack the Change 2026)" };

async function get(url: string, until: number): Promise<Response> {
  const ms = Math.max(1_000, Math.min(30_000, until - Date.now()));
  return fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(ms) });
}

// ---------- Common Crawl: every board URL in the newest crawl, one index page per step ----------
// Index API docs: https://index.commoncrawl.org. Each page holds ~15,000 captured URLs.
type CcState = { lastCrawl?: string; crawl?: string; api?: string; host?: number; page?: number; pages?: number };

const commoncrawl: Step = async (raw, until) => {
  let s = raw as CcState;
  if (!s.crawl) {
    const res = await get("https://index.commoncrawl.org/collinfo.json", until);
    if (!res.ok) throw new Error(`commoncrawl collinfo → ${res.status}`);
    const [latest] = (await res.json()) as { id: string; "cdx-api": string }[];
    if (latest.id === s.lastCrawl) return { state: s, done: true, found: [] }; // no new crawl since last time
    s = { lastCrawl: s.lastCrawl, crawl: latest.id, api: latest["cdx-api"], host: 0, page: 0 };
  }
  const h = BOARD_HOSTS[s.host!];
  const q = `${s.api}?url=${h.host}/*&output=json`;
  const found: Board[] = [];

  if (s.pages === undefined) {
    const res = await get(`${q}&showNumPages=true`, until);
    if (res.status === 404) s.pages = 0; // no captures for this host
    else if (!res.ok) throw new Error(`commoncrawl pages ${h.host} → ${res.status}`);
    else { const d = (await res.json()) as { pages: number } | number; s.pages = typeof d === "number" ? d : d.pages; }
  } else if (s.page! < s.pages) {
    const res = await get(`${q}&fl=url&page=${s.page}`, until);
    if (!res.ok && res.status !== 404) throw new Error(`commoncrawl ${h.host} page ${s.page} → ${res.status}`);
    if (res.ok) {
      for (const line of (await res.text()).split("\n")) {
        if (!line) continue;
        try { const b = boardFromUrl((JSON.parse(line) as { url: string }).url); if (b) found.push(b); } catch { /* bad line */ }
      }
    }
    s.page!++;
  }
  if (s.pages !== undefined && s.page! >= s.pages) s = { ...s, host: s.host! + 1, page: 0, pages: undefined };
  if (s.host! >= BOARD_HOSTS.length) return { state: { lastCrawl: s.crawl }, done: true, found };
  return { state: s, done: false, found };
};

// ---------- Keenable: site: searches per board host × Canadian city, one query per step ----------
const KEENABLE_PLACES = ["Calgary", "Edmonton", "Vancouver", "Toronto", "Waterloo", "Ottawa", "Montreal", "Winnipeg", "Halifax", "Remote Canada"];
export const KEENABLE_QUERIES = BOARD_HOSTS.flatMap(({ host }) =>
  KEENABLE_PLACES.map((place) => `site:${host} software developer ${place}`));

// One search. Returns every result URL; boardFromUrl decides which ones are job boards.
export async function keenableSearch(query: string, until = Date.now() + 20_000): Promise<string[]> {
  const ms = Math.max(1_000, Math.min(20_000, until - Date.now()));
  const res = await fetch("https://api.keenable.ai/v1/search/public", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Keenable-Title": "HackPack" },
    body: JSON.stringify({ query, max_results: 10 }),
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`keenable → ${res.status}`);
  const { results = [] } = (await res.json()) as { results?: { url: string }[] };
  return results.map((r) => r.url);
}

const keenable: Step = async (raw, until) => {
  const next = (raw.next as number | undefined) ?? 0;
  const urls = await keenableSearch(KEENABLE_QUERIES[next], until);
  const found = urls.map(boardFromUrl).filter((b): b is Board => b !== null);
  const done = next + 1 >= KEENABLE_QUERIES.length;
  return { state: done ? {} : { next: next + 1 }, done, found };
};

const STEPS: Record<Source, Step> = { keenable, commoncrawl };

// ---------- Runner: is it due? → steps until `until` → candidates saved after every step ----------
export type SourceReport = { source: Source; ran: boolean; finished?: boolean; steps?: number; found?: number; next_run?: string; error?: string };

export async function runSource(source: Source, until: number, { force = false } = {}): Promise<SourceReport> {
  const [row] = await sql<(RunRow & { state: State })[]>`select started_at, done_at, state from discovery_runs where source = ${source}`;
  if (!force && !isDue(source, row)) return { source, ran: false, next_run: nextRunAt(source, row)?.toISOString() };

  let state: State = row?.state ?? {};
  if (!isUnfinished(row)) {
    await sql`insert into discovery_runs (source, started_at, state) values (${source}, now(), ${sql.json(state as never)})
              on conflict (source) do update set started_at = now()`;
  }
  const r: SourceReport = { source, ran: true, finished: false, steps: 0, found: 0 };
  try {
    while (Date.now() < until) {
      const out = await STEPS[source](state, until);
      r.steps!++;
      r.found! += await saveCandidates(out.found, source);
      state = out.state;
      await sql`update discovery_runs set state = ${sql.json(state as never)} ${out.done ? sql`, done_at = now()` : sql``}
                where source = ${source}`;
      if (out.done) { r.finished = true; break; }
    }
  } catch (e) {
    r.error = String(e); // state is saved after each step, so the next call resumes from here
  }
  return r;
}

// New boards only: ones already in `boards` are skipped. A candidate checked 90+ days ago gets checked again.
async function saveCandidates(found: Board[], source: Source): Promise<number> {
  const unique = [...new Map(found.map((b) => [`${b.ats}:${b.board}`, b])).values()];
  let added = 0;
  for (let i = 0; i < unique.length; i += 5_000) {
    const rows = unique.slice(i, i + 5_000).map((b) => ({ ats: b.ats, board: b.board, found_by: source }));
    const res = await sql`
      insert into board_candidates ${sql(rows)}
      on conflict (ats, board) do update set checked_at = null, found_at = now()
        where board_candidates.checked_at < now() - interval '90 days'`;
    added += res.count;
  }
  return added;
}

// ---------- Check: does the feed work, and does it have a Canadian tech job? Then it's a board. ----------
export type CheckReport = { checked: number; added: number; left: number };

export async function checkCandidates(until: number): Promise<CheckReport> {
  const r: CheckReport = { checked: 0, added: 0, left: 0 };
  while (Date.now() < until) {
    // Keenable finds come first: its searches were already about Canada.
    const batch = await sql<{ ats: Board["ats"]; board: string; found_by: string }[]>`
      select c.ats, c.board, c.found_by from board_candidates c
      where c.checked_at is null and not exists (select 1 from boards b where b.ats = c.ats and b.board = c.board)
      order by (c.found_by = 'keenable') desc, c.found_at
      limit 50`;
    if (batch.length === 0) break;
    await pool(batch, 10, until, async (c) => {
      let canadian = false;
      try { canadian = (await fetchBoard(c)).some((j) => isTech(j) && parseLocation(j.location).canada); }
      catch { /* 404 or broken feed: not a board */ }
      if (canadian) {
        const res = await sql`insert into boards (ats, board, found_by) values (${c.ats}, ${c.board}, ${c.found_by})
                              on conflict (ats, board) do nothing`;
        r.added += res.count;
      }
      await sql`update board_candidates set checked_at = now() where ats = ${c.ats} and board = ${c.board}`;
      r.checked++;
    });
  }
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from board_candidates c
    where c.checked_at is null and not exists (select 1 from boards b where b.ats = c.ats and b.board = c.board)`;
  r.left = n;
  return r;
}
