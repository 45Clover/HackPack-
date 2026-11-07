import { auth0 } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { ROLES } from "@/lib/roles";

// Save onboarding: the skills you have, your target role, your city.
export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) return new Response("Sign in first", { status: 401 });

  const body = await req.json().catch(() => null);
  const skillIds: unknown = body?.skillIds;
  const role = ROLES.some((r) => r.slug === body?.targetRole) ? (body.targetRole as string) : "any";
  const city = typeof body?.city === "string" ? body.city.trim().slice(0, 60) || null : null;
  if (!Array.isArray(skillIds) || skillIds.length > 300 || !skillIds.every(Number.isInteger)) {
    return new Response("Bad input", { status: 400 });
  }

  const sub = session.user.sub;
  const rows = (skillIds as number[]).map((id) => ({ user_sub: sub, skill_id: id, status: "have" }));
  // One transaction, so a failure never leaves you with your old skills deleted and the new ones missing.
  await sql.begin(async (tx) => {
    await tx`
      insert into profiles (user_sub, target_role, city) values (${sub}, ${role}, ${city})
      on conflict (user_sub) do update set target_role = excluded.target_role, city = excluded.city`;
    await tx`delete from user_skills where user_sub = ${sub} and status = 'have'`;
    if (rows.length) {
      await tx`insert into user_skills ${tx(rows)} on conflict (user_sub, skill_id) do update set status = 'have'`;
    }
  });
  return Response.json({ ok: true });
}

// "Delete my data": everything we hold about you, in one go.
export async function DELETE() {
  const session = await auth0.getSession();
  if (!session) return new Response("Sign in first", { status: 401 });
  await sql.begin(async (tx) => {
    await tx`delete from user_skills where user_sub = ${session.user.sub}`;
    await tx`delete from profiles where user_sub = ${session.user.sub}`;
  });
  return Response.json({ ok: true });
}
