import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { getDashboard, getProfile } from "@/lib/dashboard";
import { resolveScope } from "@/lib/scope";
import { roleBySlug } from "@/lib/roles";
import { PublicMap } from "@/components/public-map";
import { ScopeSwitch } from "@/components/scope-switch";
import { ProfileCard } from "@/components/dashboard/profile-card";
import { PersonalGraph } from "@/components/dashboard/personal-graph";
import { Leaderboard } from "@/components/dashboard/leaderboard";

// Signed out → the public map. Signed in without a profile → onboarding. Otherwise → your dashboard.
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const session = await auth0.getSession();
  if (!session) return <PublicMap searchParams={sp} />;

  const profile = await getProfile(session.user.sub);
  if (!profile) redirect("/onboarding");

  // Your saved city is the default; the URL switch (?scope=…&city=…) still overrides it.
  const { scope, cities, note } = await resolveScope({ city: profile.city ?? undefined, ...sp });
  const data = await getDashboard(session.user.sub, scope, profile.target_role);
  const user = { name: session.user.name ?? "You", picture: session.user.picture ?? null };

  return (
    <main className="grid gap-4 lg:grid-cols-[1fr_3fr_1fr]">
      <aside className="space-y-4">
        <ProfileCard user={user} role={roleBySlug(profile.target_role).name} city={scope.city} skills={data.mine} nextSkill={data.nextSkill} />
      </aside>
      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">You, your skills, and the jobs you&apos;re closest to</h1>
          <ScopeSwitch scope={scope} cities={cities} />
        </div>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
        <PersonalGraph mine={data.mine} jobs={data.jobs} links={data.links} />
      </section>
      <aside className="space-y-4">
        <Leaderboard area={scope.kind === "canada" ? "Canada" : scope.city} leaders={data.leaders} />
      </aside>
    </main>
  );
}
