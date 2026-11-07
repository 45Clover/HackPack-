-- Run once in the Tiger Cloud SQL editor (or: psql "$DATABASE_URL" -f db/schema.sql).
-- Owner: Platform (@fabf28). Everyone codes against these tables.

create table companies (
  id    serial primary key,
  name  text not null,
  ats   text not null check (ats in ('ashby','greenhouse','lever')),
  board text not null,
  unique (ats, board)
);

create table jobs (
  id          text primary key,              -- 'ashby:benevity:<job id>'
  company_id  int  not null references companies(id),
  title       text not null,
  location    text,                          -- raw text from the feed
  city        text,                          -- 'Calgary', 'Toronto'… from lib/location.ts, null if unknown
  remote      boolean not null default false, -- remote anywhere in Canada
  url         text not null,
  description text not null,
  posted_at   timestamptz not null,
  extracted   boolean not null default false -- has Gemini read it yet?
);
create index jobs_city_idx on jobs (city);

create table skills (
  id       serial primary key,
  slug     text unique not null,             -- 'react', 'nodejs', 'csharp'
  name     text not null,                    -- 'React', 'Node.js', 'C#'
  category text
);

-- One row per (job, skill). The time-series table.
create table job_skills (
  job_id    text not null references jobs(id) on delete cascade,
  skill_id  int  not null references skills(id),
  posted_at timestamptz not null,            -- copied from jobs so Tiger can bucket by time
  primary key (job_id, skill_id, posted_at)
);
select create_hypertable('job_skills', by_range('posted_at'));

create table skill_extras (                  -- cache for slow outside APIs
  skill_id     int primary key references skills(id),
  resources    jsonb not null default '[]',  -- [{title, url}] from Keenable
  projects     jsonb not null default '[]',  -- [{title, summary, uses[]}] from Gemini
  adzuna_count int,
  updated_at   timestamptz not null default now()
);

create table stories (                       -- real people, collected at the event, with consent
  id       serial primary key,
  skill_id int  not null references skills(id),
  person   text not null,
  role     text,
  company  text,
  quote    text not null,
  consent  boolean not null check (consent)
);

create table user_skills (
  user_sub text not null,                    -- Auth0 user id ONLY. No name, no email.
  skill_id int  not null references skills(id),
  status   text not null check (status in ('have','learning')),
  primary key (user_sub, skill_id)
);
