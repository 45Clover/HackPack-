import { auth0 } from "@/lib/auth0";
import { sql } from "@/lib/db";

// Mark one skill: { skillId, status: "have" | "learning" | "none" }.
export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) return new Response("Sign in first", { status: 401 });
  const body = await req.json().catch(() => null);
  const skillId = body?.skillId, status = body?.status;
  if (!Number.isInteger(skillId) || !["have", "learning", "none"].includes(status)) return new Response("Bad input", { status: 400 });

  const sub = session.user.sub;
  if (status === "none") await sql`delete from user_skills where user_sub = ${sub} and skill_id = ${skillId}`;
  else await sql`
    insert into user_skills (user_sub, skill_id, status) values (${sub}, ${skillId}, ${status})
    on conflict (user_sub, skill_id) do update set status = excluded.status`;
  return Response.json({ ok: true });
}
