<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# HackPack: guide for every agent on this team

**Hack the Change 2026, Prompt 2.** A live map of the tech skills companies are hiring for, built from real job posts. Default view: **the visitor's city**, with a switch to **all of Canada**. Click a skill to see who's hiring, weekly demand, where to learn it, and projects that prove it. Signed-in users see the real jobs they're closest to.

**Deadline: Devpost by 11:30 AM Sunday Nov 8, Alberta time. Feature freeze at 9:30 AM.**

## Stack (decided by the team)
Next.js 16 · **Neon** (plain Postgres, `postgres` client) · **Auth0** · **n8n** fetches the job feeds and POSTs them to `/api/ingest` · the server runs Gemini (batched) and saves to Neon.

## Read before you write code
1. The hub: https://github.com/45Clover/HackPack-/issues/1 (job board, architecture, tutorial, context).
2. **Claim your task on the job board** before coding (`CLAIM T2 · agent for @user`). First claim wins.
3. The tutorial comment has the code for every task. This base already contains the shared pieces listed below.

## Who owns what. Edit ONLY your own files. (Plan v2.1: see the hub issue)
| Role | Person | Owns |
|---|---|---|
| UI / UX | @SaagiiSG | `app/**/page.tsx`, `app/layout.tsx`, `components/**`, `lib/scope.ts`, `lib/ago.ts`, `lib/dashboard.ts`, `lib/roles.ts`, `lib/resume.ts`, `lib/categories.ts`, `lib/auth0.ts`, `proxy.ts`, `app/api/resume/**`, `app/api/onboarding/**`, `db/003_profiles.sql` |
| Platform | @fabf28 | `package.json`, `.gitignore`, `.env.example`, `db/schema.sql`, `lib/db.ts`, Neon, Vercel, the Auth0 dashboard (app, callbacks, passkeys), domain |
| Job data | @45Clover | the **n8n workflow**, `lib/location.ts` (+ test), `app/api/ingest/**` |
| AI | @tomi-alo | `lib/skills.ts` (+ test), `lib/extract.ts`, `lib/extract-prompt.ts`, `lib/extras.ts`, `app/api/extract/**`, `db/002_skill_categories.sql` |
| People + pitch | Christopher? | `db/stories.sql`, Devpost page, video, pitch |

**Database setup (run in Neon, in order):** `db/schema.sql` → `db/002_skill_categories.sql` → `db/003_profiles.sql`.

Need a change in someone else's file? Comment on the hub issue and @ them. Don't edit it yourself.

## Stubs already in this base (replace the body, keep the signature)
- `lib/auth0.ts` + `proxy.ts` are **real**. They read the five `AUTH0_*`/`APP_BASE_URL` env vars on the first request, so every page needs them in `.env.local`.
- `lib/skills.ts`, `lib/extract.ts`, `lib/extras.ts`: AI fills these in (tutorial T3, T7).
- `lib/location.ts` is **real** (with a test). Ingest must use it: skip jobs where `!parseLocation(loc).canada`, and save `city` + `remote`.

## Area filter (city ↔ Canada)
- `lib/scope.ts` → `resolveScope(searchParams)` gives `{ scope, cities, note }`. The default city comes from Vercel's `x-vercel-ip-city` header (never stored), falling back to Calgary.
- In SQL, alias jobs as `j` and add `and ${inScope(scope)}`. The city view = jobs in that city **plus remote-in-Canada** jobs.
- **Ingest keeps Canadian jobs only.** No US jobs, which keeps us inside Gemini's free limits.

## Git: how we push and merge
```bash
git switch main && git pull                 # always start from fresh main
git switch -c t2-feeds                      # one branch per task
# ...work, run checks...
git add -A && git commit -m "T2: fetch Ashby/Greenhouse/Lever feeds"
git push -u origin t2-feeds
gh pr create --fill                         # then edit the description (rules below)
```
- **PR description = 3 lines in the human's own words:** what it does · why this way · one thing that could break. Every teammate must be able to explain their code to judges, or the team can be disqualified.
- **Before opening a PR, all must pass:** `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.
- **Merge:** "Squash and merge" as soon as the checks and the Vercel preview are green. Small PRs, merged every 1–2 hours. Don't sit on a branch overnight.
- **Behind main?** `git pull --rebase origin main`, fix any conflicts, then push.
- **Never:** push straight to `main`, force-push `main`, commit `.env.local`, or post keys, passwords or connection strings anywhere on GitHub. **This repo is public.**
- After merging, comment `DONE T2 · <PR link> · how to see it` on the hub issue.

## Commands
| Command | What it does |
|---|---|
| `cp .env.example .env.local` | then fill in values from the team's private chat |
| `npm run dev` | app at http://localhost:3000 (needs `DATABASE_URL` and the schema applied) |
| `npm test` | unit tests (`lib/*.test.ts`) |
| `npm run build` | must pass before any PR |

## Rules that come from the hackathon
- No reskins or wrappers of existing AI tools. AI does narrow jobs (reading skills, suggesting projects), and the app labels both.
- All AI use gets disclosed on Devpost: Gemini in the product, plus the coding agents we used.
- Real data only, no made-up or sample rows in the demo database.
- Accessibility: every visual (graph, chart) has a text or table twin. Use shadcn components (`npx shadcn@latest add <name>`).
