import { test } from "node:test";
import assert from "node:assert/strict";
import { isDue, nextRunAt } from "./schedule";

const day = 86_400_000;
const now = new Date("2026-11-08T13:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * day);

test("Keenable and Common Crawl run on different schedules", () => {
  const finished8DaysAgo = { started_at: ago(8.1), done_at: ago(8) };
  assert.equal(isDue("keenable", finished8DaysAgo, now), true);     // weekly: due again
  assert.equal(isDue("commoncrawl", finished8DaysAgo, now), false); // monthly: not yet

  const finished31DaysAgo = { started_at: ago(31.1), done_at: ago(31) };
  assert.equal(isDue("commoncrawl", finished31DaysAgo, now), true);

  assert.equal(nextRunAt("commoncrawl", finished8DaysAgo)?.toISOString(), new Date(ago(8).getTime() + 29.5 * day).toISOString());
  assert.equal(nextRunAt("keenable", finished8DaysAgo), null); // due now
});

test("the 6:00 call exactly a week later counts, though the run finished at 6:00:40", () => {
  const finishedLastWeek = { started_at: new Date("2026-11-01T13:00:00Z"), done_at: new Date("2026-11-01T13:00:40Z") };
  assert.equal(isDue("keenable", finishedLastWeek, new Date("2026-11-08T13:00:00Z")), true);
  assert.equal(isDue("keenable", finishedLastWeek, new Date("2026-11-07T13:00:00Z")), false); // day 6: not yet
});

test("never run = due; an unfinished run resumes the next day whatever the interval", () => {
  assert.equal(isDue("commoncrawl", undefined, now), true);
  assert.equal(isDue("commoncrawl", { started_at: null, done_at: null }, now), true);
  // Common Crawl started yesterday, after a run that finished 2 days ago: carry on, don't wait 30 days.
  assert.equal(isDue("commoncrawl", { started_at: ago(1), done_at: ago(2) }, now), true);
  assert.equal(isDue("keenable", { started_at: ago(1), done_at: null }, now), true);
});
