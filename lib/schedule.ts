// Owner: Job data. When each part of the daily call runs. No database here, so it's easy to test.
//
// n8n makes ONE call a day (POST /api/ingest). It never says what to do; lib/daily.ts asks this file.
// - The daily fetch runs on every call.
// - Each discovery source has its own interval. A run that doesn't finish in one call carries on the next day.

export type Source = "keenable" | "commoncrawl";

export const DISCOVERY_EVERY_DAYS: Record<Source, number> = {
  keenable: 7,     // live search index: new postings (and new companies) show up within days
  commoncrawl: 30, // Common Crawl publishes a new crawl about once a month, so sooner finds nothing new
};

// A board fetched in the last 20 h is skipped, so a second call on the same day (a manual test) doesn't
// fetch everything again, and each board is tried at most once a day (that's what makes `fails` count days).
export const FRESH_HOURS = 20;

export type RunRow = { started_at: Date | null; done_at: Date | null };

// Unfinished = started after the last finish. It resumes on the next call, whatever the interval.
export const isUnfinished = (r: RunRow | undefined) =>
  !!r?.started_at && (!r.done_at || r.started_at > r.done_at);

// A run finishes a few seconds after the 6:00 call, so "7 days later" at 6:00 is a few seconds short of 7 days.
// 12 h of slack makes the 7th day's call count, instead of slipping every run to day 8.
const SLACK_MS = 12 * 3_600_000;
const intervalMs = (source: Source) => DISCOVERY_EVERY_DAYS[source] * 86_400_000 - SLACK_MS;

export function isDue(source: Source, r: RunRow | undefined, now = new Date()): boolean {
  if (isUnfinished(r)) return true;
  if (!r?.done_at) return true; // never run
  return now.getTime() - r.done_at.getTime() >= intervalMs(source);
}

export function nextRunAt(source: Source, r: RunRow | undefined): Date | null {
  if (isDue(source, r)) return null;
  return new Date(r!.done_at!.getTime() + intervalMs(source));
}
