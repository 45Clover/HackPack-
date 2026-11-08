-- 003: onboarding answers. Run once in Neon, after 002.
-- Auth0 user id; name and email were added in 006. Never the resume.
create table if not exists profiles (   -- schema.sql creates it too; this keeps a fresh setup from failing
  user_sub     text primary key,
  target_role  text,            -- a slug from lib/roles.ts, e.g. 'backend'
  city         text,
  onboarded_at timestamptz not null default now()
);
