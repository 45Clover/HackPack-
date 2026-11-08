// Shows the feed URLs the daily call would fetch, batch by batch. Read-only: it never writes to the database.
//
//   npx tsx --env-file=.env.local scripts/batches.ts              batches of 100 from the boards table (the real queue)
//   npx tsx --env-file=.env.local scripts/batches.ts 5            batches of 5, so a short list still shows several
//   npx tsx --env-file=.env.local scripts/batches.ts 5 --fetch    ...and call each feed: jobs / Canadian tech jobs
//   npx tsx --env-file=.env.local scripts/batches.ts keenable 3   the URLs Keenable discovery finds right now (3 searches)
//
// No DATABASE_URL in .env.local? It shows the 19 starting boards from db/007_boards.sql instead.
import { readFileSync } from "node:fs";
import { feedUrl, fetchBoard, isTech, type Ats, type Board } from "../lib/feeds";
import { parseLocation } from "../lib/location";
import { boardFromUrl } from "../lib/board-url";

const args = process.argv.slice(2);
const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);

async function showBatches() {
  const size = nums[0] ?? 100;
  let boards: Board[];
  if (process.env.DATABASE_URL) {
    const { dueBoards } = await import("../lib/ingest");
    boards = await dueBoards(100_000);
    console.log(`From the boards table: ${boards.length} boards due now (not tried in the last 20 h), longest-waiting first.`);
  } else {
    const seed = readFileSync(new URL("../db/007_boards.sql", import.meta.url), "utf8");
    boards = [...seed.matchAll(/\('[^']*', '(ashby|greenhouse|lever)', '([^']+)', '\w+'\)/g)].map((m) => ({ ats: m[1] as Ats, board: m[2] }));
    console.log(`No DATABASE_URL, so this is the starting list in db/007_boards.sql (${boards.length} boards).`);
  }
  if (boards.length === 0) { console.log("Nothing due: every active board was fetched in the last 20 h."); return; }

  const batches = Math.ceil(boards.length / size);
  for (let i = 0; i < batches; i++) {
    const batch = boards.slice(i * size, (i + 1) * size);
    console.log(`\nBatch ${i + 1} of ${batches} (${batch.length} boards)`);
    if (!args.includes("--fetch")) {
      for (const b of batch) console.log(`  ${b.ats.padEnd(10)} ${b.board.padEnd(16)} ${feedUrl(b)}`);
      continue;
    }
    const t0 = Date.now();
    const lines = await Promise.all(batch.map(async (b) => {
      try {
        const feed = await fetchBoard(b);
        const keep = feed.filter((j) => isTech(j) && parseLocation(j.location).canada).length;
        return `  ${b.ats.padEnd(10)} ${b.board.padEnd(16)} ${`${feed.length} jobs, ${keep} Canadian tech`.padEnd(28)} ${feedUrl(b)}`;
      } catch (e) {
        return `  ${b.ats.padEnd(10)} ${b.board.padEnd(16)} ${"FAILED".padEnd(28)} ${(e as Error).message}`;
      }
    }));
    console.log(lines.join("\n"));
    console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
}

async function showKeenable() {
  const { KEENABLE_QUERIES, keenableSearch } = await import("../lib/discover");
  const n = Math.min(nums[0] ?? 3, KEENABLE_QUERIES.length);
  console.log(`Keenable discovery: ${n} of its ${KEENABLE_QUERIES.length} searches. A full run does all of them, once a week.`);
  for (const q of KEENABLE_QUERIES.slice(0, n)) {
    console.log(`\n"${q}"`);
    for (const url of await keenableSearch(q)) {
      const b = boardFromUrl(url);
      console.log(b ? `  ✓ ${url}\n      → ${b.ats}:${b.board}  feed ${feedUrl(b)}` : `  · ${url}  (not a job board, skipped)`);
    }
  }
  console.log("\n✓ = becomes a candidate. The check step adds it to boards if its feed has a Canadian tech job.");
}

(args[0] === "keenable" ? showKeenable() : showBatches())
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
