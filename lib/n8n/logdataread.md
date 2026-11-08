# lib/n8n: daily refresh with n8n (T8)

n8n makes **one** call a day. It doesn't loop, pick batches or know about discovery. The server decides all of that,
so the n8n workflow never has to change when the board list grows or a schedule changes.

```
n8n Schedule Trigger (6:00 Alberta time)
  └─> POST https://<live-url>/api/ingest   header: x-ingest-secret   (no body)
        └─> lib/daily.ts  (40 s budget, then it stops and answers)
              1. daily fetch   lib/ingest.ts    every call: due boards, 100 per batch, longest-waiting first
              2. discovery     lib/discover.ts  only if due (lib/schedule.ts): Keenable weekly, Common Crawl monthly
              3. check         lib/discover.ts  found boards → boards table, if the feed works and has a Canadian tech job
```

| File | What it is |
|---|---|
| `n8n-daily-ingest.json` | Workflow to import into n8n Cloud. Holds **no secret** (the repo is public). |
| `trigger-ingest.ts` | Sends the same request from your laptop, to test the endpoint without n8n. |
| `../schedule.ts` | **The schedule.** How often each discovery source runs. Change it here, not in n8n. |
| `../daily.ts` | What one call does, and how the 40 s are split. |
| `../../db/005_boards.sql` | The `boards`, `board_candidates` and `discovery_runs` tables + the 19 starting boards. |

## How the server picks what to do

- **Which boards (batches):** every call takes the active boards that haven't been tried in 20 h, longest-waiting first,
  100 at a time, until its 25 s slice runs out. Whatever is left goes first tomorrow. No cursor and no `?batch=`:
  the `last_tried_at` column is the queue. 20 feeds load in parallel, so about 500 boards fit in one call.
- **When discovery runs:** `discovery_runs` remembers when each source last finished.

  | Source | Runs every | Why | One step |
  |---|---|---|---|
  | Keenable | 7 days | live search index: new posts and companies show up within days | 1 search (40 in a run: 4 board hosts × 10 places) |
  | Common Crawl | 30 days | a new crawl comes out about once a month, so sooner finds nothing new | 1 index page (~15,000 URLs) |

  A run that doesn't finish in one call **carries on the next day**, from the step where it stopped, whatever the interval.
  If the newest crawl is the one we already read, Common Crawl finishes at once.
- **Failures stay apart:** the fetch always goes first. Discovery errors are caught and reported, and never touch the fetch.
  A feed that fails 3 days in a row is switched off (`active = false`).

## Set it up

Needs: `INGEST_SECRET` set in Vercel → Settings → Environment Variables, and `db/005_boards.sql` run in Neon.

1. **Import.** n8n Cloud → *Create workflow* → **⋯ → Import from File** → pick `lib/n8n/n8n-daily-ingest.json`.
2. **URL.** Open the **POST /api/ingest** node and replace `REPLACE-WITH-LIVE-URL` with the Vercel URL (or our domain).
3. **Secret.** In the same node, under *Credential for Header Auth* → **Create new credential**:
   - Name: `x-ingest-secret`
   - Value: the `INGEST_SECRET` from the team's private chat

   n8n stores this encrypted. Never paste it into the workflow JSON, a commit or an issue.
4. **Test.** Click **Execute workflow**. Screenshot the output for the pitch. It looks like:
   ```json
   { "fetched": { "batches": 1, "boards": 19, "ok": 19, "failed": 0, "saved": 168, "left": 0 },
     "discovery": [ { "source": "keenable", "ran": true, "finished": false, "steps": 12, "found": 30 },
                    { "source": "commoncrawl", "ran": false, "next_run": "2026-12-07T13:00:00.000Z" } ],
     "checked": { "checked": 30, "added": 9, "left": 0 },
     "seconds": 40 }
   ```
5. **Turn on.** Flip the **Active** toggle (top right). Check **Executions** the next morning.

## First big load (by hand, no 40 s limit)

Common Crawl has far more board URLs than one 8 s slice a day gets through. Run the first pass from a laptop.
It saves progress the same way, so the daily call carries on from where the script stopped:

```bash
npx tsx --env-file=.env.local scripts/discover.ts keenable 5        # all 40 searches
npx tsx --env-file=.env.local scripts/discover.ts commoncrawl 30     # 30 minutes of index pages
npx tsx --env-file=.env.local scripts/discover.ts check 20           # candidates → boards
```

## Test from your laptop

```bash
npx tsx --env-file=.env.local lib/n8n/trigger-ingest.ts                       # local: npm run dev first
npx tsx --env-file=.env.local lib/n8n/trigger-ingest.ts https://<live-url>     # deployed
```

| Response | Meaning |
|---|---|
| `200 {"fetched":…}` | Working |
| `403 Forbidden` | Secret in n8n / `.env.local` doesn't match Vercel's `INGEST_SECRET` |
| `404` | Route not deployed yet, or wrong URL |
| `"error"` inside `discovery` | That source failed this time; it resumes from the same step next call. The fetch still ran |

## Choices worth knowing

- **No AI in the ingest call** (plan v2.1). Gemini reads new jobs through `/api/extract`, so calling ingest twice costs no quota.
- **Then `POST /api/extract?batch=5`, three times in a row** (added by Tomi): each is one Gemini call on the next 5 unread jobs (Calgary first), so 15 jobs and 3 Gemini calls per morning. Same Header Auth credential as ingest. No retry, no loop. Each call has its own 60 s on Vercel; 8 jobs in one call ran past Gemini's deadline live (504), 5 fits. If nothing is unread, a call returns `{ extracted: 0 }` without calling Gemini.
- **Big catch-ups run from a laptop**, not from n8n: `/api/extract` with no `?batch` reads 20 jobs per call and has no time limit, so the same pile costs 4× fewer Gemini calls.
- **Calling twice is safe:** boards fetched in the last 20 h are skipped, jobs are `on conflict do nothing`, and discovery
  continues where it was.
- **Timezone is `America/Edmonton`** in the workflow settings, so 6:00 means Alberta time, not UTC.
- **Timeout is 90 s** in n8n. The server stops itself at 40 s (`maxDuration` is 60 s), so n8n always gets an answer.
- **Backup if n8n is cut** (cut order in the hub issue): run `trigger-ingest.ts` by hand before the demo.
