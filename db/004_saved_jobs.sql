-- 004: jobs you bookmarked ("Saved" on the dashboard). Run once in Neon, after 003.
-- "Started" skills already live in user_skills with status = 'learning'.
create table saved_jobs (
  user_sub text not null,               -- Auth0 user id only
  job_id   text not null references jobs(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_sub, job_id)
);
