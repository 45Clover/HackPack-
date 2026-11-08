import { redirect } from "next/navigation";
import { auth0, authReady } from "@/lib/auth0";
import { getDashboard, getProfile, getSavedAndStarted } from "@/lib/dashboard";
import { resolveScope } from "@/lib/scope";
import { roleBySlug } from "@/lib/roles";
import { PublicMap } from "@/components/public-map";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

// Signed out → the public map. Signed in without a profile → onboarding. Otherwise → your dashboard.
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const session = authReady ? await auth0.getSession() : null;
  if (!session) return <PublicMap searchParams={sp} />;

  const profile = await getProfile(session.user.sub);
  if (!profile) redirect("/onboarding");

  // Your saved city is the default; the URL switch (?scope=…&city=…) still overrides it.
  const { scope, cities } = await resolveScope({ city: profile.city ?? undefined, ...sp });
  const [data, mineLists] = await Promise.all([
    getDashboard(session.user.sub, scope, profile.target_role),
    getSavedAndStarted(session.user.sub),
  ]);

  return (
    <DashboardShell
      user={{ name: session.user.name ?? "You", picture: session.user.picture ?? null }}
      role={roleBySlug(profile.target_role).name}
      scope={scope}
      cities={cities}
      mine={data.mine}
      jobs={data.jobs}
      links={data.links}
      leaders={data.leaders}
      saved={mineLists.saved}
      started={mineLists.started}
      persist
    />
  );
}
