import { auth0 } from "@/lib/auth0";
import { sql } from "@/lib/db";

// Mark one skill: { skillId, status: "have" | "learning" | "none", projectUrl? }.
// Finishing a skill you were learning comes with a link to a project that uses it.
export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) return new Response("Sign in first", { status: 401 });
  const body = await req.json().catch(() => null);
  const skillId = body?.skillId, status = body?.status;
  if (!Number.isInteger(skillId) || !["have", "learning", "none"].includes(status)) return new Response("Bad input", { status: 400 });
  const projectUrl = typeof body?.projectUrl === "string" && /^https?:\/\/\S+\.\S+/.test(body.projectUrl) && body.projectUrl.length <= 300 ? body.projectUrl : null;

  const sub = session.user.sub;
  if (status === "none") await sql`delete from user_skills where user_sub = ${sub} and skill_id = ${skillId}`;
  else await sql`
    insert into user_skills (user_sub, skill_id, status, project_url) values (${sub}, ${skillId}, ${status}, ${projectUrl})
    on conflict (user_sub, skill_id) do update set status = excluded.status, project_url = coalesce(excluded.project_url, user_skills.project_url)`;
  return Response.json({ ok: true });
}
