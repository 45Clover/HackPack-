import { redirect } from "next/navigation";
import { auth0, authReady } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { getDashboard, getDashboardFor, getProfile, getSavedAndStarted, type MySkill } from "@/lib/dashboard";
import { readGuest } from "@/lib/guest";
import { resolveScope } from "@/lib/scope";
import { roleBySlug, roleFrom } from "@/lib/roles";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Landing } from "@/components/landing/landing";

// Signed out → the landing page, or a guest's own map once they've done onboarding (cookie, nothing stored).
// Signed in without a profile → onboarding. Otherwise → your dashboard.
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const session = authReady ? await auth0.getSession() : null;
  const guest = session ? null : await readGuest();
  // A guest who finished onboarding: their real map from the cookie, nothing stored, plus "Save your map".
  if (guest) {
    const { scope, cities } = await resolveScope({ city: guest.city ?? undefined, ...sp });
    const mine = await sql<MySkill[]>`select id, slug, name, category from skills where id = any(${guest.skillIds}::int[]) order by name`;
    const roleSlug = roleFrom(sp.role, guest.role); // the filter menu can look at another role
    const data = await getDashboardFor([...mine], scope, roleSlug);
    return (
      <DashboardShell
        user={{ name: "Guest", picture: null }}
        role={roleBySlug(roleSlug).name}
        roleSlug={roleSlug ?? undefined}
        scope={scope}
        cities={cities}
        mine={data.mine}
        jobs={data.jobs}
        links={data.links}
        leaders={data.leaders}
        saved={[]}
        started={[]}
        persist={false}
        guest
      />
    );
  }
  if (!session) return <Landing searchParams={sp} />; // a first-time visitor: the landing page

  const profile = await getProfile(session.user.sub);
  if (!profile) redirect("/onboarding");

  // Your saved city is the default; the URL switch (?scope=…&city=…) still overrides it.
  const { scope, cities } = await resolveScope({ city: profile.city ?? undefined, ...sp });
  const roleSlug = roleFrom(sp.role, profile.target_role); // ?role= from the filter menu; your saved role stays saved
  const [data, mineLists] = await Promise.all([
    getDashboard(session.user.sub, scope, roleSlug),
    getSavedAndStarted(session.user.sub),
  ]);

  return (
    <DashboardShell
      user={{ name: session.user.name ?? "You", picture: session.user.picture ?? null }}
      role={roleBySlug(roleSlug).name}
      roleSlug={roleSlug ?? undefined}
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
