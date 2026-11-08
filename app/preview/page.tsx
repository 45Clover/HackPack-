// DEV-ONLY design preview: the real dashboard on the real Neon jobs, without Auth0. A sample resume stands in for you.
// shortcut: throwaway preview for design work; delete once Auth0 sign-in works.
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getDashboardFor, type MySkill } from "@/lib/dashboard";
import { resolveScope } from "@/lib/scope";
import { roleBySlug, roleFrom } from "@/lib/roles";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const SAMPLE_RESUME = ["javascript", "typescript", "react", "node-js", "sql", "postgresql", "git", "python"];

export default async function Preview({ searchParams }: PageProps<"/preview">) {
  if (process.env.NODE_ENV !== "development") notFound();
  const sp = await searchParams;
  const { scope, cities } = await resolveScope({ scope: "canada", ...sp }); // all of Canada unless ?scope=city
  const mine = await sql<MySkill[]>`select id, slug, name, category from skills where slug = any(${SAMPLE_RESUME}::text[]) order by name`;
  const roleSlug = roleFrom(sp.role, "any")!;
  const data = await getDashboardFor([...mine], scope, roleSlug);

  return (
    <DashboardShell
      user={{ name: "Sample Student", picture: null }}
      role={roleBySlug(roleSlug).name}
      roleSlug={roleSlug}
      scope={scope}
      cities={cities}
      mine={data.mine}
      jobs={data.jobs}
      links={data.links}
      leaders={data.leaders}
      saved={[]}
      started={[]}
      persist={false}
      initialFocus={typeof sp.focus === "string" ? sp.focus : undefined}
      initialSidebarOpen={sp.sidebar !== "closed"}
      initialView={sp.view === "tree" || sp.view === "match" ? sp.view : "map"}
      layout={sp.layout === "force" ? "force" : undefined}
      myRole="fullstack" // the sample student is aiming for full-stack
    />
  );
}
