-- 009 (issue #21): what kind of job a post is, and what kind a student is looking for.
-- Ingest fills jobs.job_type from the feeds (Ashby employmentType, Lever commitment: task I2). Null = the post doesn't say;
-- the app then counts Gemini's seniority = 'intern' or an intern / co-op title as an internship (lib/dashboard.ts).
alter table jobs add column if not exists job_type text
  check (job_type in ('full_time', 'internship', 'part_time', 'contract', 'temporary'));
alter table profiles add column if not exists looking_for text not null default 'both'
  check (looking_for in ('internship', 'full_time', 'both'));
update jobs set job_type = 'internship'
  where job_type is null and (seniority = 'intern' or title ~* '\m(intern|internship|co-?op)\M');
