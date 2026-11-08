import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { getProfile } from "@/lib/dashboard";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function Onboarding() {
  const session = await auth0.getSession();
  if (!session) redirect("/auth/login?returnTo=/onboarding");
  const sub = session.user.sub;

  const [profile, mine, allSkills, cities] = await Promise.all([
    getProfile(sub),
    sql<{ id: number }[]>`select skill_id as id from user_skills where user_sub = ${sub} and status = 'have'`,
    sql<{ id: number; slug: string; name: string; category: string | null }[]>`
      select s.id, s.slug, s.name, s.category from skills s
      join job_skills js on js.skill_id = s.id group by s.id order by count(*) desc`,
    sql<{ city: string }[]>`select city from jobs where city is not null group by city order by count(*) desc`,
  ]);
  // Pre-fill the city from Vercel's IP-location header (never stored unless you confirm it).
  const header = (await headers()).get("x-vercel-ip-city");
  const guessCity = header ? decodeURIComponent(header) : "Calgary";

  return (
    <main className="mx-auto max-w-2xl">
      <OnboardingFlow
        firstName={session.user.given_name ?? session.user.name?.split(" ")[0] ?? "there"}
        skills={[...allSkills]}
        cities={cities.map((c) => c.city)}
        initial={{ skillIds: mine.map((m) => m.id), role: profile?.target_role ?? "any", city: profile?.city ?? guessCity }}
      />
    </main>
  );
}
