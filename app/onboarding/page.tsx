import { headers } from "next/headers";
import { auth0, authReady } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { getProfile } from "@/lib/dashboard";
import { readGuest } from "@/lib/guest";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

// Signed in: edit your saved answers. A guest: same flow, answers kept in a cookie until they sign in (value first).
export default async function Onboarding() {
  const session = authReady ? await auth0.getSession() : null;
  const sub = session?.user.sub;

  const [profile, mine, guest, allSkills, cities] = await Promise.all([
    sub ? getProfile(sub) : null,
    sub ? sql<{ id: number }[]>`select skill_id as id from user_skills where user_sub = ${sub} and status = 'have'` : [],
    sub ? null : readGuest(),
    sql<{ id: number; slug: string; name: string; category: string | null }[]>`
      select s.id, s.slug, s.name, s.category from skills s
      join job_skills js on js.skill_id = s.id group by s.id order by count(*) desc`,
    sql<{ city: string }[]>`select city from jobs where city is not null group by city order by count(*) desc`,
  ]);
  // Pre-fill the city from Vercel's IP-location header (never stored unless you confirm it).
  const header = (await headers()).get("x-vercel-ip-city");
  const guessCity = header ? decodeURIComponent(header) : "Calgary";

  return (
    <OnboardingFlow
      firstName={session ? session.user.given_name ?? session.user.name?.split(" ")[0] ?? "there" : undefined}
      skills={[...allSkills]}
      cities={cities.map((c) => c.city)}
      initial={
        session
          ? { skillIds: mine.map((m) => m.id), role: profile?.target_role ?? "any", city: profile?.city ?? guessCity }
          : { skillIds: guest?.skillIds ?? [], role: guest?.role ?? "any", city: guest?.city ?? guessCity }
      }
    />
  );
}
