-- 006: keep the student's name and email from their sign-in (Google or email), so we can reach them.
-- Run once in Neon, after 005. Filled in when a signed-in student finishes onboarding or saves their guest map.
alter table profiles add column if not exists name  text;
alter table profiles add column if not exists email text;
