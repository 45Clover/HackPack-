// Owner: UI (@SaagiiSG). Onboarding answers: a guest's live in the `hp_guest` cookie (nothing in the database)
// until they sign in and claim them. Signed-in answers go straight to Neon, with the name and email from sign-in (db/006).
import { cookies, headers } from "next/headers";
import { sql } from "./db";
import { getProfile } from "./dashboard";
import { ROLES, lookingForFrom, type LookingFor } from "./roles";

export type Answers = { skillIds: number[]; role: string; city: string | null; lookingFor: LookingFor };

const COOKIE = "hp_guest";
const MAX_SKILLS = 200; // ~1 KB of ids, far under the 4 KB cookie cap (the DB has ~70 skills)

// The onboarding POST body → clean answers, or null if the skills list is bad. Unknown roles fall back to "any".
export function answersFromBody(body: unknown): Answers | null {
  const b = (body ?? {}) as { skillIds?: unknown; targetRole?: unknown; city?: unknown; lookingFor?: unknown };
  const ids = b.skillIds;
  if (!Array.isArray(ids) || ids.length > MAX_SKILLS || !ids.every(Number.isInteger)) return null;
  const role = ROLES.some((r) => r.slug === b.targetRole) ? (b.targetRole as string) : "any";
  const city = typeof b.city === "string" ? b.city.trim().slice(0, 60) || null : null;
  // No duplicates: one insert can't touch a row twice. Not saying what you're looking for = both.
  return { skillIds: [...new Set(ids as number[])], role, city, lookingFor: lookingForFrom(b.lookingFor) };
}

// We wrote the cookie, so it must already be clean. Anything else (edited, truncated, old shape) counts as no cookie.
export function parseGuest(raw: string | undefined): Answers | null {
  try {
    const g = JSON.parse(raw ?? "");
    const a = answersFromBody({ skillIds: g.skillIds, targetRole: g.role, city: g.city, lookingFor: g.lookingFor });
    // Cookies from before db/009 have no lookingFor: they still count, as "both".
    return a && a.role === g.role && a.city === g.city && a.lookingFor === (g.lookingFor ?? "both") ? a : null;
  } catch {
    return null;
  }
}

export type Skill = { id: number; slug: string; name: string; category: string | null };
export type AnswersForm = { skills: Skill[]; cities: string[]; initial: { skillIds: number[]; role: string; city: string; lookingFor: LookingFor } };

// What the onboarding page and the Edit profile dialog start from: every skill (most asked for first), the cities with
// jobs, and your answers so far (signed in: Neon; a guest: the cookie). No city yet: Vercel's IP guess, never stored
// unless you confirm it.
export async function getAnswersForm(sub: string | null): Promise<AnswersForm> {
  const [profile, mine, guest, skills, cities, ipCity] = await Promise.all([
    sub ? getProfile(sub) : null,
    sub ? sql<{ id: number }[]>`select skill_id as id from user_skills where user_sub = ${sub} and status = 'have'` : [],
    sub ? null : readGuest(),
    sql<Skill[]>`
      select s.id, s.slug, s.name, s.category from skills s
      join job_skills js on js.skill_id = s.id group by s.id order by count(*) desc`,
    sql<{ city: string }[]>`select city from jobs where city is not null group by city order by count(*) desc`,
    headers().then((h) => h.get("x-vercel-ip-city")),
  ]);
  const guessCity = ipCity ? decodeURIComponent(ipCity) : "Calgary";
  return {
    skills: [...skills],
    cities: cities.map((c) => c.city),
    initial: sub
      ? { skillIds: mine.map((m) => m.id), role: profile?.target_role ?? "any", city: profile?.city ?? guessCity, lookingFor: lookingForFrom(profile?.looking_for) }
      : { skillIds: guest?.skillIds ?? [], role: guest?.role ?? "any", city: guest?.city ?? guessCity, lookingFor: guest?.lookingFor ?? "both" },
  };
}

export async function readGuest() {
  return parseGuest((await cookies()).get(COOKIE)?.value);
}

// Route handlers only (Next can't set cookies while a page renders).
export async function writeGuest(a: Answers) {
  (await cookies()).set(COOKIE, JSON.stringify(a), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearGuest() {
  (await cookies()).delete(COOKIE);
}

// Save answers for a signed-in user: the onboarding POST and the guest claim both use this.
// `user` is the Auth0 session user; name and email can be missing (then they're saved as null).
export async function saveAnswers(user: { sub: string; name?: string | null; email?: string | null }, a: Answers) {
  const sub = user.sub;
  const rows = a.skillIds.map((id) => ({ user_sub: sub, skill_id: id, status: "have" }));
  // One transaction, so a failure never leaves you with your old skills deleted and the new ones missing.
  await sql.begin(async (tx) => {
    await tx`
      insert into profiles (user_sub, target_role, city, name, email, looking_for)
      values (${sub}, ${a.role}, ${a.city}, ${user.name ?? null}, ${user.email ?? null}, ${a.lookingFor})
      on conflict (user_sub) do update
      set target_role = excluded.target_role, city = excluded.city, name = excluded.name, email = excluded.email,
          looking_for = excluded.looking_for`;
    await tx`delete from user_skills where user_sub = ${sub} and status = 'have'`;
    if (rows.length) {
      await tx`insert into user_skills ${tx(rows)} on conflict (user_sub, skill_id) do update set status = 'have'`;
    }
  });
}
