-- Run in the Neon SQL editor after schema.sql (or: psql "$DATABASE_URL" -f db/007_boards.sql). Plain Postgres, no extensions.
-- Owner: Job data. The board list for ingest: which company feeds to fetch, and what discovery has found.
-- v2.1: if not exists guards, so running it again is harmless. Does not change any table in schema.sql.

create table if not exists boards (
  id            serial primary key,
  ats           text not null check (ats in ('ashby','greenhouse','lever')),
  board         text not null,                 -- the slug in the feed URL: jobs.ashbyhq.com/<board>
  name          text,                          -- shown in the UI; falls back to the slug
  found_by      text not null check (found_by in ('commoncrawl','keenable','adzuna','manual')),
  active        boolean not null default true, -- false once the feed has failed 3 days in a row
  fails         int  not null default 0,       -- failed days in a row (reset by a good fetch)
  last_ok_at    timestamptz,
  last_tried_at timestamptz,                   -- the daily fetch takes the boards tried longest ago first
  unique (ats, board)
);

create table if not exists board_candidates ( -- found by discovery, not checked yet
  ats        text not null check (ats in ('ashby','greenhouse','lever')),
  board      text not null,
  found_by   text not null,
  found_at   timestamptz not null default now(),
  checked_at timestamptz,                      -- null = not checked yet
  primary key (ats, board)
);

create table if not exists discovery_runs (   -- one row per source; a run can take several days
  source     text primary key,                 -- 'commoncrawl' | 'keenable'
  started_at timestamptz,
  done_at    timestamptz,                      -- last finished run; the next one is due done_at + its interval
  state      jsonb not null default '{}'       -- where an unfinished run stopped
);

-- The starting list (from the tutorial, all checked live on Nov 7). Already there = skipped.
insert into boards (name, ats, board, found_by) values
  ('Benevity', 'ashby', 'benevity', 'manual'),
  ('Neo Financial', 'ashby', 'neofinancial', 'manual'),
  ('Jobber', 'ashby', 'jobber', 'manual'),
  ('Cohere', 'ashby', 'cohere', 'manual'),
  ('Lightspeed', 'ashby', 'lightspeedhq', 'manual'),
  ('Hootsuite', 'greenhouse', 'hootsuite', 'manual'),
  ('Hopper', 'ashby', 'hopper', 'manual'),
  ('Float', 'ashby', 'float', 'manual'),
  ('Wealthsimple', 'ashby', 'wealthsimple', 'manual'),
  ('1Password', 'ashby', '1password', 'manual'),
  ('Trulioo', 'ashby', 'trulioo', 'manual'),
  ('Loopio', 'ashby', 'loopio', 'manual'),
  ('Procurify', 'ashby', 'procurify', 'manual'),
  ('Clutch', 'greenhouse', 'clutch', 'manual'),
  ('Faire', 'greenhouse', 'faire', 'manual'),
  ('Ritual', 'greenhouse', 'ritual', 'manual'),
  ('PolicyMe', 'lever', 'policyme', 'manual'),
  ('Wave', 'lever', 'waveapps', 'manual'),
  ('Arcadia', 'lever', 'arcadia', 'manual')
on conflict (ats, board) do nothing;
