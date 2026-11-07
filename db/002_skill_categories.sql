-- 002: skill categories, job seniority, must-have vs nice-to-have. Run once in Neon, after schema.sql.
-- The category rows must match lib/categories.ts (the Gemini prompt and the UI read that file).

create table skill_categories (
  slug text primary key,
  name text not null,
  sort int  not null
);

insert into skill_categories (slug, name, sort) values
  ('language',     'Languages',         1),
  ('frontend',     'Frontend',          2),
  ('backend',      'Backend',           3),
  ('database',     'Databases',         4),
  ('cloud-devops', 'Cloud & DevOps',    5),
  ('data-ai',      'Data & AI',         6),
  ('mobile',       'Mobile',            7),
  ('testing',      'Testing & QA',      8),
  ('security',     'Security',          9),
  ('practice',     'Tools & practices', 10);

-- Any skill saved before this migration with an old category gets cleared, then re-filled on the next extract.
update skills set category = null where category is not null and category not in (select slug from skill_categories);
alter table skills add constraint skills_category_fk foreign key (category) references skill_categories(slug);

-- What level the job is for (students care about intern/junior).
alter table jobs add column seniority text check (seniority in ('intern','junior','mid','senior','lead','unknown'));

-- false = the post calls it a "nice to have" / "bonus" / "asset".
alter table job_skills add column required boolean not null default true;
