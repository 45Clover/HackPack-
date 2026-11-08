import { auth0, authReady } from "@/lib/auth0";
import { getAnswersForm } from "@/lib/guest";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

// Signed in: edit your saved answers. A guest: same flow, answers kept in a cookie until they sign in (value first).
// Inside the app, "Edit skills & resume" opens a dialog instead (components/profile/edit-profile.tsx).
export default async function Onboarding() {
  const session = authReady ? await auth0.getSession() : null;
  const form = await getAnswersForm(session?.user.sub ?? null);
  return (
    <OnboardingFlow
      firstName={session ? session.user.given_name ?? session.user.name?.split(" ")[0] ?? "there" : undefined}
      {...form}
    />
  );
}
