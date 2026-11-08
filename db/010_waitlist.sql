-- 010: pre-registration. Run once in Neon (009 is job types). Emails are stored lowercased and trimmed (lib/waitlist.ts),
-- used only to announce the launch, never shared. Joining twice updates the row.
create table if not exists waitlist (
  id          serial primary key,
  email       text not null unique,
  role        text not null check (role in ('student','career_switcher','educator','employer')),
  internships boolean not null default false,  -- "Tell me when internships go live"
  source      text not null default 'landing', -- 'landing', 'waitlist' (the QR page) or 'joinearly'
  created_at  timestamptz not null default now()
);
