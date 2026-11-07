# logdata: daily refresh with n8n (T8)

n8n calls our ingest endpoint once a day, so the skill map stays fresh with no server of our own.

```
n8n Schedule Trigger (6:00 Alberta time)
  └─> POST https://<live-url>/api/ingest   header: x-ingest-secret
        └─> lib/ingest.ts: fetch feeds → keep Canadian tech jobs → save → Gemini reads new jobs (1 call)
              └─> {"jobs": …, "extracted": …}
```

| File | What it is |
|---|---|
| `n8n-daily-ingest.json` | Workflow to import into n8n Cloud. Holds **no secret** (the repo is public). |
| `trigger-ingest.ts` | Sends the same request from your laptop, to test the endpoint without n8n. |

## Set it up (about 5 minutes)

Needs: `/api/ingest` deployed (T2), and `INGEST_SECRET` set in Vercel → Settings → Environment Variables.

1. **Import.** n8n Cloud → *Create workflow* → **⋯ → Import from File** → pick `logdata/n8n-daily-ingest.json`.
2. **URL.** Open the **POST /api/ingest** node and replace `REPLACE-WITH-LIVE-URL` with the Vercel URL (or our domain once T8 step 2 is done).
3. **Secret.** In the same node, under *Credential for Header Auth* → **Create new credential**:
   - Name: `x-ingest-secret`
   - Value: the `INGEST_SECRET` from the team's private chat
   
   n8n stores this encrypted. Never paste it into the workflow JSON, a commit or an issue.
4. **Test.** Click **Execute workflow**. The output should look like `{"jobs": 312, "extracted": 20}`. Screenshot it for the pitch.
5. **Turn on.** Flip the **Active** toggle (top right). Check **Executions** the next morning.

## Test from your laptop

```bash
npx tsx --env-file=.env.local logdata/trigger-ingest.ts                       # local: npm run dev first
npx tsx --env-file=.env.local logdata/trigger-ingest.ts https://<live-url>     # deployed
```

| Response | Meaning |
|---|---|
| `200 {"jobs":…,"extracted":…}` | Working |
| `403 Forbidden` | Secret in n8n / `.env.local` doesn't match Vercel's `INGEST_SECRET` |
| `404` | Route not deployed yet (T2), or wrong URL |
| timeout | Ingest ran past Vercel's 60 s limit. Fewer feeds per run, or check the Vercel logs |

## Choices worth knowing

- **Once a day, no automatic retry.** Every call spends Gemini quota (`extractLimit: 1`), and the free tier is tight. A retry after a timeout could spend it twice. If a run fails, run it again by hand.
- **Timezone is `America/Edmonton`** in the workflow settings, so 6:00 means Alberta time, not UTC.
- **Timeout is 90 s** in n8n, longer than Vercel's 60 s `maxDuration`, so n8n reports Vercel's real error rather than its own timeout.
- **Backup if n8n is cut** (cut order in the hub issue): run `scripts/ingest.ts` by hand before the demo.
