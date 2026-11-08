import { redirect } from "next/navigation";
import { auth0, authReady } from "@/lib/auth0";
import { clearGuest, readGuest, saveAnswers } from "@/lib/guest";

// "Save your map": after sign-in, move the guest's answers from the cookie into Neon, then open their dashboard.
export async function GET() {
  const session = authReady ? await auth0.getSession() : null;
  if (!session) redirect("/login?returnTo=/api/onboarding/claim");

  const guest = await readGuest();
  if (guest) await saveAnswers(session.user, guest);
  await clearGuest(); // also drops a bad cookie
  redirect("/");
}
