// Owner: Job data. The one call n8n makes each morning. n8n doesn't pick batches or sources; this file does.
//
//   0s ─────────── daily fetch ─────────── 25s ── discovery (if due) ── 33s ── check candidates ── 40s
//
// Each part gets until its mark. If one finishes early, the next part gets the spare time.
// 40 s + one slow feed (10 s timeout) still ends inside Vercel's 60 s limit, and n8n waits 90 s.
// Discovery is wrapped so its errors never touch the fetch. The fetch always goes first.
import { fetchDueBoards } from "./ingest";
import { checkCandidates, runSource, type SourceReport } from "./discover";
import type { Source } from "./schedule";

// Keenable first: its runs are short (40 queries), so a Common Crawl run in progress can't starve it.
const SOURCES: Source[] = ["keenable", "commoncrawl"];

export async function runDaily({ budgetMs = 40_000 } = {}) {
  const t0 = Date.now();
  const end = t0 + budgetMs;

  const fetched = await fetchDueBoards({ until: end - 15_000 });

  const discovery: SourceReport[] = [];
  for (const s of SOURCES) {
    discovery.push(await runSource(s, end - 7_000).catch((e) => ({ source: s, ran: false, error: String(e) })));
  }
  const checked = await checkCandidates(end).catch((e) => ({ error: String(e) }));

  return { fetched, discovery, checked, seconds: Math.round((Date.now() - t0) / 1000) };
}
