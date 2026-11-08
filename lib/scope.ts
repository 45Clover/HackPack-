// Owner: UI (@SaagiiSG). Which area the visitor is looking at: their city (default) or all of Canada.
import { headers } from "next/headers";
import { sql } from "./db";

// remote / week: the job filters ("Remote only", "Posted this week"), read from ?remote=1 and ?week=1.
export type Scope = { kind: "city" | "canada"; city: string; remote: boolean; week: boolean };
type SearchParams = Record<string, string | string[] | undefined>;

export async function resolveScope(sp: SearchParams) {
  // Default city comes from Vercel's IP-location header. We never store it. Local dev has no header, so Calgary.
  const header = (await headers()).get("x-vercel-ip-city");
  const city = typeof sp.city === "string" ? sp.city : header ? decodeURIComponent(header) : "Calgary";
  const rows = await sql`select city from jobs where city is not null group by city order by count(*) desc`;
  const cities = rows.map((r) => r.city as string);
  const remote = sp.remote === "1", week = sp.week === "1";

  if (sp.scope !== "canada" && !cities.includes(city)) {
    return { scope: { kind: "canada", city, remote, week } as Scope, cities, note: `No job posts in ${city} yet, so we're showing all of Canada.` };
  }
  return { scope: { kind: sp.scope === "canada" ? "canada" : "city", city, remote, week } as Scope, cities, note: null };
}

// SQL filter for a query that aliases jobs as `j`. The city view also includes remote-in-Canada jobs.
export const inScope = (s: Scope) => sql`${s.kind === "canada" ? sql`true` : sql`(j.city = ${s.city} or j.remote)`}
  ${s.remote ? sql`and j.remote` : sql``} ${s.week ? sql`and j.posted_at > now() - interval '7 days'` : sql``}`;
