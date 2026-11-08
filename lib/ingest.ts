// Owner: Job data. Path 2, the daily fetch: boards table → feeds → Canadian tech jobs → jobs table.
// No AI here (plan v2.1): Gemini reads the new jobs through /api/extract.
import { sql } from "./db";
import { fetchBoard, isTech, type Ats, type FeedJob } from "./feeds";
import { parseLocation } from "./location";
import { pool } from "./pool";
import { FRESH_HOURS } from "./schedule";

export const BATCH_SIZE = 100;
const PARALLEL = 20;  // feeds fetched at the same time (≈ 20 boards/s, so ~500 in the 25 s slice)
const MAX_FAILS = 3;  // failed days in a row before a board is switched off

export type BoardRow = { id: number; ats: Ats; board: string; name: string | null };

// The queue: active boards not tried in the last FRESH_HOURS, longest-waiting first.
// The daily fetch takes `limit` = one batch at a time; scripts/batches.ts reads it to show the batches.
export const dueBoards = (limit: number) => sql<BoardRow[]>`
  select id, ats, board, name from boards
  where active and (last_tried_at is null or last_tried_at < now() - make_interval(hours => ${FRESH_HOURS}))
  order by last_tried_at nulls first, id
  limit ${limit}`;

export type FetchReport = { batches: number; boards: number; ok: number; failed: number; saved: number; left: number };

// Fetches due boards (not tried in the last FRESH_HOURS), longest-waiting first, one batch of 100 at a time,
// until every board is fresh or `until` passes. Whatever is left goes first on the next call.
export async function fetchDueBoards({ until, size = BATCH_SIZE }: { until: number; size?: number }): Promise<FetchReport> {
  const r: FetchReport = { batches: 0, boards: 0, ok: 0, failed: 0, saved: 0, left: 0 };
  while (Date.now() < until) {
    const batch = await dueBoards(size);
    if (batch.length === 0) break;
    r.batches++;
    await pool(batch, PARALLEL, until, async (b) => {
      r.boards++;
      try {
        r.saved += await saveJobs(b, await fetchBoard(b));
        await sql`update boards set last_tried_at = now(), last_ok_at = now(), fails = 0 where id = ${b.id}`;
        r.ok++;
      } catch (e) {
        console.error(`ingest ${b.ats}:${b.board}`, e);
        await sql`update boards set last_tried_at = now(), fails = fails + 1, active = fails + 1 < ${MAX_FAILS}
                  where id = ${b.id}`.catch(() => {});
        r.failed++;
      }
    });
  }
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from boards
    where active and (last_tried_at is null or last_tried_at < now() - make_interval(hours => ${FRESH_HOURS}))`;
  r.left = n;
  return r;
}

// Keeps Canadian tech jobs only, and saves them in one insert. Returns how many were new.
async function saveJobs(b: BoardRow, feed: FeedJob[]): Promise<number> {
  const keep = feed.filter(isTech).flatMap((j) => {
    const loc = parseLocation(j.location);
    return loc.canada ? [{ j, loc }] : [];
  });
  if (keep.length === 0) return 0;

  const [company] = await sql<{ id: number }[]>`
    insert into companies (name, ats, board) values (${b.name ?? b.board}, ${b.ats}, ${b.board})
    on conflict (ats, board) do update set name = excluded.name
    returning id`;
  const rows = keep.map(({ j, loc }) => ({
    id: `${b.ats}:${b.board}:${j.externalId}`, company_id: company.id, title: j.title, location: j.location,
    city: loc.city, remote: loc.remote, url: j.url, description: j.description, posted_at: j.postedAt,
  }));
  const res = await sql`insert into jobs ${sql(rows)} on conflict (id) do nothing`;
  return res.count;
}
