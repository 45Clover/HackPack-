import { auth0 } from "@/lib/auth0";
import { sql } from "@/lib/db";

// Save or unsave a job: { jobId, saved }.
export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) return new Response("Sign in first", { status: 401 });
  const body = await req.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" && body.jobId.length <= 200 ? body.jobId : null;
  if (!jobId || typeof body?.saved !== "boolean") return new Response("Bad input", { status: 400 });

  const sub = session.user.sub;
  if (body.saved) await sql`insert into saved_jobs (user_sub, job_id) values (${sub}, ${jobId}) on conflict do nothing`;
  else await sql`delete from saved_jobs where user_sub = ${sub} and job_id = ${jobId}`;
  return Response.json({ ok: true });
}
