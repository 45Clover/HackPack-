-- 008: "Impact projects" on each skill's Learning guide. Run once in Neon, after 007.
-- A real Canadian problem from public data (Statistics Canada or the UN SDG database) and a project that helps
-- with it while practising the skill. Filled by scripts/impact-generate.ts (Gemini, run by hand), never on a page view.
-- `series` keeps the exact points the text quotes, so every number on the page can be checked against its source.
create table if not exists impact_projects (
  id            serial primary key,
  skill_id      int  not null references skills(id) on delete cascade,
  source        text not null check (source in ('statcan','unsdg')),
  dataset_id    text not null,        -- StatCan table number or SDG indicator: '14-10-0441-01', '8.6.1'
  dataset_title text not null,
  dataset_url   text not null,        -- a human page to cite
  unit          text not null,        -- '%', '$', 'beds'...
  series        jsonb not null,       -- [{period, value}] oldest first, from data/impact-datasets.json
  problem       text not null,
  build         text not null,        -- what to build
  practice      text not null,        -- how it uses the skill
  proof         text not null,        -- what to submit as proof
  sdg_goal      text,                 -- UN goal number, e.g. '8'
  model         text not null,        -- which Gemini wrote the text (shown as AI-suggested)
  created_at    timestamptz not null default now(),
  unique (skill_id, dataset_id)
);
