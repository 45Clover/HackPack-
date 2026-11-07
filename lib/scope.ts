// Owner: UI (@SaagiiSG). Which area the visitor is looking at: their city (default) or all of Canada.
import { headers } from "next/headers";
import { sql } from "./db";

export type Scope = { kind: "city" | "canada"; city: string };
type SearchParams = Record<string, string | string[] | undefined>;

export async function resolveScope(sp: SearchParams) {
  // Default city comes from Vercel's IP-location header. We never store it. Local dev has no header, so Calgary.
  const header = (await headers()).get("x-vercel-ip-city");
  const city = typeof sp.city === "string" ? sp.city : header ? decodeURIComponent(header) : "Calgary";
  const rows = await sql`select city from jobs where city is not null group by city order by count(*) desc`;
  const cities = rows.map((r) => r.city as string);

  if (sp.scope !== "canada" && !cities.includes(city)) {
    return { scope: { kind: "canada", city } as Scope, cities, note: `No job posts in ${city} yet, so we're showing all of Canada.` };
  }
  return { scope: { kind: sp.scope === "canada" ? "canada" : "city", city } as Scope, cities, note: null };
}

// SQL filter for a query that aliases jobs as `j`. The city view also includes remote-in-Canada jobs.
export const inScope = (s: Scope) => (s.kind === "canada" ? sql`true` : sql`(j.city = ${s.city} or j.remote)`);
