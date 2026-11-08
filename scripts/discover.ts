// Runs discovery by hand with no 45 s limit. Use it for the first big Common Crawl pass.
// It ignores the schedule, and saves progress the same way, so the daily call carries on where it stopped.
//
//   npx tsx --env-file=.env.local scripts/discover.ts keenable      [minutes=10]
//   npx tsx --env-file=.env.local scripts/discover.ts commoncrawl   [minutes=10]
//   npx tsx --env-file=.env.local scripts/discover.ts check         [minutes=10]   (candidates → boards)
import { checkCandidates, runSource } from "../lib/discover";

async function main() {
  const what = process.argv[2];
  const until = Date.now() + Number(process.argv[3] ?? 10) * 60_000;
  if (what === "keenable" || what === "commoncrawl") console.log(await runSource(what, until, { force: true }));
  else if (what === "check") console.log(await checkCandidates(until));
  else { console.error("usage: scripts/discover.ts keenable|commoncrawl|check [minutes]"); process.exit(1); }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
