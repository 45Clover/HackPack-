import { auth0, authReady } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { answersFromBody, clearGuest, getAnswersForm, saveAnswers, writeGuest } from "@/lib/guest";

// The Edit profile dialog's starting point: every skill, the cities, and your answers so far (or a guest's cookie).
export async function GET() {
  const session = authReady ? await auth0.getSession() : null;
  return Response.json(await getAnswersForm(session?.user.sub ?? null));
}

// Save onboarding: the skills you have, your target role, your city.
// Signed in → Neon (plus your name and email from sign-in). A guest → the hp_guest cookie only, until they sign in and claim it (/api/onboarding/claim).
export async function POST(req: Request) {
  const session = authReady ? await auth0.getSession() : null;
  const answers = answersFromBody(await req.json().catch(() => null));
  if (!answers) return new Response("Bad input", { status: 400 });

  if (session) await saveAnswers(session.user, answers);
  else await writeGuest(answers);
  return Response.json({ ok: true });
}

// "Delete my data": everything we hold about you, in one go. A guest: forget the cookie.
export async function DELETE() {
  const session = authReady ? await auth0.getSession() : null;
  if (!session) {
    await clearGuest();
    return Response.json({ ok: true });
  }
  await sql.begin(async (tx) => {
    await tx`delete from user_skills where user_sub = ${session.user.sub}`;
    await tx`delete from saved_jobs where user_sub = ${session.user.sub}`;
    await tx`delete from profiles where user_sub = ${session.user.sub}`;
  });
  return Response.json({ ok: true });
}
