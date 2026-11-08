import { sql } from "@/lib/db";
import { isBot, parseWaitlist } from "@/lib/waitlist";

// Join the waitlist: { email, role, internships, source, company }. Joining again updates the row and the answer is the
// same, so nobody can test whether an email is on the list. A filled `company` (the honeypot) is a bot: say ok, save nothing.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (isBot(body)) return Response.json({ ok: true });
  const w = parseWaitlist(body);
  if (!w) return new Response("Check your email and pick who you are.", { status: 400 });
  await sql`
    insert into waitlist (email, role, internships, source) values (${w.email}, ${w.role}, ${w.internships}, ${w.source})
    on conflict (email) do update set role = excluded.role, internships = excluded.internships`;
  return Response.json({ ok: true });
}

// How many have joined, for "N people have joined".
export async function GET() {
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from waitlist`;
  return Response.json({ count });
}
