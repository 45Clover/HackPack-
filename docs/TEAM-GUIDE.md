# Skilltrii (team HackPack): how it works and why we built it this way

> Read this once, then make sure you can explain **your own files** without an AI helping you.
> The rules say: *"An inability to explain any technical design and/or code during judging may result in disqualification."*

---

## 1. What it is, in one breath

**Skilltrii** is a live map of the tech skills Canadian companies are hiring for **right now**, built from real job posts.
It starts on **your city** (with a switch to **all of Canada**). You tell it your skills (pick them, or upload a resume) and it shows
**you → your skills → the real jobs you're closest to → the one skill that would get you closer.** Click a skill to see who's hiring,
how demand is trending, where to learn it, and projects that would prove it.

**Prompt 2:** *help people develop in-demand skills in a rapidly changing job market.* We answer it with **real data** (not guesses)
about what employers ask for, made personal.

---

## 2. The big picture

```
                    ┌───────────── once a week / month ─────────────┐
                    │  DISCOVERY: find company job boards            │
                    │  Keenable search + Common Crawl index          │
                    └──────────────┬─────────────────────────────────┘
                                   ▼ new boards
 n8n (6:00 AM Alberta)      ┌──────────────┐
  ── POST /api/ingest ───►  │ Next.js on   │ ── fetch feeds ──► Ashby / Greenhouse / Lever public JSON
  ── POST /api/extract ──►  │ Vercel       │ ── 1 call / 5–20 jobs ──► Gemini (reads skills)
     (×3, 5 jobs each)      └──────┬───────┘
                                   ▼
                            ┌──────────────┐
                            │ Neon         │  companies · jobs · skills · job_skills · profiles · ...
                            │ (Postgres)   │
                            └──────┬───────┘
                                   ▼ SQL (counts, trends, "closest jobs")
 Visitor ── Auth0 sign-in ──► pages: landing · onboarding · dashboard (3D map + table) · skill guide
```

Two halves:
1. **The data pipeline** (no user involved): find boards → fetch jobs → Gemini reads skills → save in Neon.
2. **The app** (what the user sees): plain SQL over that data, personalised with the user's skills.

**Key idea: AI does one narrow job (reading skills out of job text). Everything else is plain code and SQL we wrote.**
That's on purpose: the rules ban "reskins of existing AI tools".

---

## 3. Services we use, and why each one

| Service | What it does for us | Why this one |
|---|---|---|
| **Next.js 16** (App Router) | Pages *and* API routes in one project; server components query the DB directly | One codebase, one deploy. No separate backend to host |
| **Vercel** | Hosting. Also gives us the visitor's city from the `x-vercel-ip-city` header | Zero-config for Next.js. Free city guess, and we **never store it** |
| **Neon** | Hosted plain Postgres | Real SQL (joins, `count(*) filter`, time windows) is exactly what "demand per skill per week" needs. Free tier, serverless |
| **`postgres` npm client** | Runs SQL with tagged templates: `` sql`select ... where id = ${id}` `` | Values are sent as parameters, so it's **safe from SQL injection** without an ORM |
| **Auth0** | Sign-in (incl. passkeys), session cookie | Don't roll our own auth. Also an MLH prize |
| **n8n** | Cron: one scheduled call each morning | Visual, no server to run. The server decides *what* to do, so the workflow never changes |
| **Gemini** (`@google/genai`) | Reads job posts → list of skills + category + required/nice-to-have + seniority | Structured JSON output with a schema. MLH prize |
| **Keenable** | Search API: finds job boards, and "learn X" links on skill pages | Real live links, so **the AI never invents a URL** |
| **Common Crawl** | Public web index: finds thousands of company board URLs | Free, huge. Runs monthly because a new crawl comes out ~monthly |
| **StatCan / UN SDG data** | Real numbers behind the "impact projects" on skill pages | Real Canadian problems, real data (organizers suggested StatCan) |
| **shadcn/ui, Tailwind, react-force-graph-3d, Recharts, GSAP** | UI components, the 3D skill map, charts, animation | shadcn is accessible by default (a hackathon rule) |
| **GoDaddy Registry** | Domain `skilltrii.work` | MLH prize |

---

## 4. The data pipeline, step by step

### Step 0. Where jobs come from: company ATS feeds
Most tech companies post jobs through an **ATS** (Applicant Tracking System): **Ashby, Greenhouse or Lever**. Each has a **free, public JSON
feed** per company (e.g. `boards-api.greenhouse.io/v1/boards/<company>/jobs`).
**Why:** these are the companies' *own* posts. No scraping LinkedIn/Indeed (against their terms, and it breaks), no paid API.
→ `lib/feeds.ts` has one function per ATS that turns each feed into the **same shape** (`FeedJob`). That's the *adapter pattern*.

### Step 1. Discovery: finding boards (`lib/discover.ts`, `lib/board-url.ts`)
We can only fetch boards we know about. Discovery finds new ones:
- **Keenable** every 7 days: searches like `site:jobs.ashbyhq.com software developer Calgary`.
- **Common Crawl** every 30 days: reads every captured URL on the ATS hosts.
- `boardFromUrl` turns a URL into `{ats, board}`. A candidate is only added to `boards` if its feed works **and** has at least one Canadian tech job.
- Runs are split into small steps that **save their place** (`discovery_runs`), so a run can span several days. Schedules live in `lib/schedule.ts` (pure, tested).

### Step 2. Daily fetch (`POST /api/ingest` → `lib/daily.ts` → `lib/ingest.ts`)
n8n makes **one empty POST** each morning with a secret header. The server decides everything:
- Takes boards not tried in the last 20 h, longest-waiting first, 100 per batch, 20 feeds in parallel (`lib/pool.ts`).
- The `last_tried_at` column **is the queue**. No cursor to lose.
- Keeps only **tech titles** (`isTech`, a keyword regex) in **Canada** (`lib/location.ts` → `parseLocation`, gives `city` + `remote`).
- `insert ... on conflict do nothing`, so running it twice is harmless (**idempotent**).
- A feed failing 3 days in a row is switched off.
- Time budget: fetch until 25 s, discovery until 33 s, checks until 40 s. Vercel kills functions at 60 s, so we always answer in time.

**No AI in ingest.** That way, calling ingest again costs no Gemini quota.

### Step 3. Gemini reads skills (`POST /api/extract` → `lib/extract.ts`, `lib/extract-prompt.ts`)
- Picks unread jobs (`extracted = false`), **Calgary first**, newest first.
- Sends **many jobs in ONE request** (5 from n8n on Vercel, 20 from a laptop). The free tier is counted in *requests per day*, so batching = more jobs per day.
- Asks for **JSON matching a schema**, `temperature: 0`, with clear include/exclude rules and one worked example (*few-shot prompting*).
- **Never trust model output:** `cleanResults` drops ids we didn't send, duplicates, and categories that aren't in our list.
- `lib/skills.ts` → `canonicalSkill` merges spellings ("ReactJS", "React.js" → `react`), so the map has one node per skill.
- Saves each job in **one transaction**: all its skills or none. A job Gemini skipped stays unread and gets retried.
- **Model fallback:** 3 pinned models, each with its own quota. If one is out of quota, overloaded or times out (429/503/504), try the next. Pinned names, so a model can't change under us mid-demo.

### Step 4. The app reads it with SQL
Demand, trends and "closest jobs" are **just SQL** over `job_skills` (`lib/dashboard.ts`). No AI at page-view time.

---

## 5. The user side

| Route | What it does | Files |
|---|---|---|
| `/` | Signed out: landing page. Guest who did onboarding: their map (from a cookie). Signed in: dashboard | `app/page.tsx`, `components/landing/*`, `components/dashboard/*` |
| `/onboarding` | Pick skills or **upload a resume** → role → city → internship/full-time | `components/onboarding/onboarding-flow.tsx`, `app/api/onboarding/*` |
| `/skills/[slug]` | The **Learning guide**: who's hiring, weekly demand chart, learn links, AI project ideas (labelled), impact projects | `components/skill/*`, `lib/extras.ts`, `lib/impact/*` |
| `/explore` | Every mapped job + the 3D map, with filters | `app/explore/page.tsx` |
| `/about` | How it works, **AI disclosure**, what we store | `app/about/page.tsx` |
| `/waitlist` | Pre-registration form (honeypot field against bots) | `components/waitlist/*`, `app/api/waitlist`, `lib/waitlist.ts` |
| `/preview` | The dashboard with a sample resume, no sign-in needed (for demos/dev) | `app/preview/*` |

Things worth knowing:
- **City vs Canada** (`lib/scope.ts`): `resolveScope` picks the area. `inScope(scope)` is a reusable SQL fragment: city view = jobs in that city **plus** remote-in-Canada jobs. If a city has no jobs, it falls back to Canada with a note.
- **Resume upload uses NO AI** (`lib/resume.ts`): the PDF is read **in memory** (`unpdf`), matched against our known skill names with whole-word regex, and **never saved**. Short names like "Go" or "R" must match case exactly so "go to" doesn't count.
- **Guest first, sign in later** (`lib/guest.ts`): onboarding answers live in an `httpOnly` cookie, nothing in the DB. "Save your map" signs you in and `/api/onboarding/claim` moves them into Neon. You see value **before** we ask for an account.
- **"Closest jobs"** (`getDashboardFor`): for each job, (must-have skills you have) ÷ (must-have skills it asks for), highest first. **"Next skill"** = the missing skill that shows up most in those jobs.
- **Trend arrow**: jobs asking for a skill in the last 7 days vs the 7 days before.
- **Skill guide as a drawer**: `app/@drawer/(.)skills/[slug]` is a Next.js **parallel + intercepting route**. Clicked inside the app, it slides up over the page. Shared or refreshed, the same URL opens the full page.
- **Accessibility:** every visual has a text twin (`components/skill-table.tsx` next to the graph; charts have tables). shadcn components, keyboard use.
- **Auth** (`lib/auth0.ts`, `proxy.ts`): `proxy.ts` is Next 16's new name for middleware. It mounts `/auth/login`, `/auth/logout`, `/auth/callback`. `authReady` lets the app run without Auth0 keys in dev.

---

## 6. Folder map

```
app/                 pages (page.tsx) and API routes (app/api/**/route.ts)
  api/ingest         n8n's morning call: fetch feeds → jobs table           (secret header)
  api/extract        one Gemini call on the next unread jobs                (secret header)
  api/extras         one-off: AI project ideas for the top skills           (secret header)
  api/resume         PDF → known skills (in memory, nothing stored)
  api/onboarding     save / delete your answers; /claim moves guest cookie → DB
  api/skill-status   mark a skill "have" / "learning" (+ project link)
  api/saved          save / unsave a job
  api/waitlist       join the waitlist
  @drawer/           the slide-up Learning guide (intercepting route)
components/          UI (dashboard, landing, onboarding, skill guide, shadcn ui/)
lib/                 all the logic, framework-free where possible
  db.ts              ONE shared Postgres client (pooled Neon URL)
  feeds.ts           ATS feeds → one common job shape
  location.ts        free-text location → city / remote / in Canada   (+ test)
  ingest.ts daily.ts schedule.ts discover.ts board-url.ts pool.ts      the pipeline
  extract.ts extract-prompt.ts skills.ts categories.ts                 the AI step
  scope.ts dashboard.ts roles.ts guest.ts resume.ts extras.ts impact/  what pages need
  n8n/               the n8n workflow JSON (no secrets) + a laptop trigger script
  *.test.ts          unit tests (run with `npm test`)
db/                  SQL migrations, run in order in Neon (schema.sql → 002 → ... → 010)
scripts/             one-off tools run from a laptop (discovery catch-up, seeding, impact data)
data/                impact datasets (StatCan / UN SDG)
```

### The database (Neon)
| Table | One row = |
|---|---|
| `boards` | a company job board we fetch daily (+ `fails`, `last_tried_at` = the queue) |
| `board_candidates`, `discovery_runs` | boards found but not checked yet; where each discovery run stopped |
| `companies` | a company |
| `jobs` | a Canadian tech job post (`city`, `remote`, `extracted`, `seniority`, `job_type`) |
| `skills` | a skill (`slug`, `name`, `category`) |
| `job_skills` | "this job asks for this skill" (+ `required`). `posted_at` is **copied in** so trend queries skip a join (deliberate *denormalisation*) |
| `skill_extras` | cache of learn links + AI project ideas per skill |
| `impact_projects` | pre-written projects tied to real StatCan / SDG data |
| `profiles`, `user_skills`, `saved_jobs` | a signed-in user's answers, skills, saved jobs (keyed by Auth0 `sub`) |
| `waitlist` | an email that pre-registered |

---

## 7. Decisions we made, and why (the "not vibecoded" part)

Each one: **what we chose → why → what we gave up.** Learn the ones in your area.

1. **Company ATS feeds, not scraping or a jobs API.** Real employer posts, free, legal, stable JSON. *Gave up:* companies on other systems (Workday, etc.) are missing. We dropped Adzuna because we can count jobs ourselves.
2. **Canada only, at ingest time.** Fits the prompt and the Calgary judges, and keeps us inside Gemini's free limits. *Gave up:* US data.
3. **Discovery is automated.** We started with 19 hand-picked boards; Keenable + Common Crawl grow the list without anyone typing slugs.
4. **n8n makes one dumb call; the server decides.** Scheduling logic lives in tested TypeScript (`schedule.ts`), not in a visual workflow. Changing the schedule never touches n8n. *(Early plan had n8n sending job lists itself. We moved the logic server-side when the board list grew.)*
5. **Ingest and extraction are separate endpoints.** Fetching is free and repeatable; Gemini calls are scarce. Keeping them apart means a retry of one never burns the other.
6. **Batching + model fallback for Gemini.** The free tier limits *requests*, not jobs, so we pack 5–20 jobs per request. Three models = three quotas. Small batches on Vercel because 8 jobs once ran past the 60 s limit live (504).
7. **AI output is validated, never trusted.** Schema-constrained JSON, then `cleanResults`, then `canonicalSkill`, then a transaction.
8. **AI never runs on a page view.** Learn links and project ideas are cached in `skill_extras`; impact projects are generated ahead of time by a script. A busy demo can't drain the quota or slow the page.
9. **Resume matching uses no AI and stores nothing.** Privacy (Clio prize), speed, and it only matches skills that exist in our data.
10. **Guest-first onboarding with a cookie.** Show value before asking for an account. Nothing in the DB until you sign in.
11. **Idempotent everything.** `on conflict do nothing`, the 20 h freshness window, retries on unread jobs. Running anything twice is safe.
12. **Time budgets everywhere.** 10 s per feed, 40 s per daily call, 25/55 s for Gemini, so Vercel's 60 s limit never cuts us off mid-write.
13. **Plain Postgres + raw SQL, no ORM.** The core features *are* aggregate queries. `postgres` tagged templates keep them injection-safe.
14. **Product rules in code:** secrets in env vars only (public repo), a secret header on every endpoint that costs money, Calgary first (local impact).

**Known rough edges (say them before a judge finds them):** `isTech` is a title keyword regex; `parseLocation` only knows 16 cities;
resume matching is exact-name regex; Gemini can miss or mislabel a skill, and we haven't measured its accuracy yet; we only see companies on Ashby/Greenhouse/Lever.
Each has a simple fix we'd do next.

---

## 8. Questions judges will likely ask

- **"Where does the data come from?"** Companies' own public job feeds (Ashby/Greenhouse/Lever), fetched every morning. Canadian tech jobs only.
- **"What does the AI do?"** One job: read a post and list the skills it asks for (+ required or nice-to-have, + seniority). It also suggests portfolio projects, labelled "AI-suggested". Everything else is SQL.
- **"How do you know it's accurate?"** Be honest: we haven't measured it yet. What we do: schema-constrained output at temperature 0, a prompt with clear include/exclude rules and an example, validation in code, and one canonical name per skill. Every job links to the original post, so anyone can check. Next step: hand-check a sample of jobs and publish the number.
- **"What do you store about me?"** Auth0 id, name + email from sign-in, role, city, the skills you save. Never the resume. Guests: nothing (cookie). One button deletes it all.
- **"Does it scale? What does it cost?"** Neon + Vercel + n8n free tiers. Gemini is the only per-job cost: ~1 request per 5–20 jobs, pennies on a paid key. More boards = more rows, same code.
- **"Why not just use LinkedIn?"** LinkedIn shows jobs one at a time. We show the *pattern*: which skills are rising in your city this week, and the one skill that unlocks the most jobs you're close to.
- **"Who pays for this?"** This is the business-model question: who would fund running Skilltrii after the hackathon? The rubric's "Feasibility" score asks for a realistic budget and an adoption plan. Agree on ONE answer as a team, for example: free for students, paid by **universities, colleges and bootcamps** (live data on which skills to teach) or by **career centres / newcomer programs** (to advise students). Running costs are small: free tiers plus a few dollars of Gemini.

---

## 9. Who owns what (see `AGENTS.md`)

| Person | Area | Be ready to explain |
|---|---|---|
| @SaagiiSG | UI / UX | pages, components, onboarding, dashboard SQL, scope, guest cookie, resume, Auth0 code |
| @fabf28 | Platform | Neon, Vercel, env vars, Auth0 dashboard, schema, domain |
| @45Clover | Job data | feeds, location parsing, ingest, discovery, daily schedule, n8n |
| @tomi-alo | AI | Gemini prompt + batching + fallback, validation, skill names, extras, extract route |
| Christopher | People + pitch | the story, Devpost, video, the numbers, AI disclosure |

**Everyone** should be able to draw section 2 on a whiteboard and explain decisions 1, 5, 7, 8 and 9.

---

## 10. Optional quiz (answers below, cover them first)

1. Where do our job posts come from, and why not LinkedIn?
2. What does n8n send to `/api/ingest`, and who decides which boards get fetched?
3. Why are ingest and extract two separate endpoints?
4. Why do we send several jobs in one Gemini request?
5. Name two things we do because we don't trust Gemini's output.
6. What happens if Gemini skips a job in its answer?
7. Does uploading a resume call AI? Is the file saved?
8. In the city view, which jobs are included?
9. How is "closest jobs" calculated?
10. Why does `job_skills` have its own `posted_at` column?
11. What makes calling `/api/ingest` twice in one morning safe?
12. What is `proxy.ts`, and why that name?
13. Why does the skill guide open as a drawer but also work as a normal page?
14. Name one rough edge in the data and how you'd fix it.

<details><summary>Answers</summary>

1. Companies' own public ATS feeds (Ashby, Greenhouse, Lever). Scraping LinkedIn breaks their terms and breaks often; feeds are free, stable JSON straight from the employer.
2. Nothing but a secret header. `lib/daily.ts` decides: boards not tried in 20 h, longest-waiting first, plus discovery if it's due (`lib/schedule.ts`).
3. Fetching is free and repeatable; Gemini calls are limited. Keeping them apart means retrying one never costs the other, and ingest never burns quota.
4. The free tier counts *requests per day*, not jobs. One request with 5–20 jobs reads 5–20× more jobs per day.
5. Any of: JSON schema + temperature 0; drop ids we didn't send; drop duplicates; drop unknown categories; `canonicalSkill` merges spellings; save in a transaction.
6. It stays `extracted = false`, so a later call picks it up again.
7. No AI. The PDF is read in memory, matched against our skill names, and thrown away.
8. Jobs in that city **plus** remote-in-Canada jobs (`inScope` in `lib/scope.ts`).
9. (Must-have skills of the job that you have) ÷ (must-have skills it asks for), highest first, newest breaks ties.
10. Denormalisation: trend queries ("this week vs last week") read one table and skip a join with `jobs`.
11. Boards fetched in the last 20 h are skipped, and jobs insert with `on conflict do nothing`.
12. Next.js 16's name for middleware. It runs Auth0's middleware: login/logout/callback routes and a fresh session cookie.
13. A parallel route (`@drawer`) plus an intercepting route (`(.)skills/[slug]`): in-app clicks show the drawer, a direct visit shows the full page, same URL.
14. E.g. `isTech` is a title regex (could miss "Solutions Specialist"); `parseLocation` knows 16 cities; resume match is exact names (aliases from `skills.ts` would help).

</details>

---

## 11. Prompt to give your AI helper

Copy this into Claude / ChatGPT / Copilot chat **inside the repo**, and fill in the brackets.

```text
I'm [NAME] on team HackPack at Hack the Change 2026. Our project is Skilltrii (repo: github.com/45Clover/HackPack-).
I owned [ROLE, e.g. "Job data: lib/feeds.ts, lib/location.ts, lib/ingest.ts, app/api/ingest, the n8n workflow"].
Judging is soon, and we can be disqualified if I can't explain our code, so I need to understand it myself.

1. Read docs/TEAM-GUIDE.md, AGENTS.md, and the files I own. Do NOT edit any files.
2. Explain the whole system to me in under 10 short bullet points: the data pipeline, the app, and how they connect.
3. Then walk me through my files one at a time: what each one does, why it was built that way, what the
   alternative was, and the name of the concept (e.g. "idempotency", "adapter pattern"). Keep each
   explanation short and plain. Wait for me to say "next" before moving on.
4. For each of my files, tell me the 1-2 questions a judge (a working software engineer) is most likely to
   ask, and help me practise answering in my own words. Correct me if I'm wrong or vague.
5. Point out any weakness or rough edge in my part honestly, and give me a one-sentence "what we'd do next".
6. Finish with a 5-question quiz on the whole project (not just my part). Don't show answers until I try.

Rules: no jargon without explaining it, one idea at a time, don't write new code.
```
