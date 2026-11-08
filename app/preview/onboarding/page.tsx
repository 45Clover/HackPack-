// DEV-ONLY design preview of onboarding (no Auth0, no database). Resume upload needs sign-in, so it won't work here.
// shortcut: throwaway preview for design work; delete once onboarding runs for real.
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

const DICT = CATEGORIES.flatMap((c, ci) =>
  c.hint.split(":")[1].split(",").map((n, i) => ({ id: ci * 100 + i, name: n.trim(), slug: n.trim().toLowerCase(), category: c.slug as string })),
);

export default function OnboardingPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <OnboardingFlow
      firstName="Sample"
      skills={DICT}
      cities={["Calgary", "Toronto", "Vancouver", "Edmonton"]}
      initial={{ skillIds: DICT.filter((s) => ["React", "TypeScript", "Node.js"].includes(s.name)).map((s) => s.id), role: "any", city: "Calgary", lookingFor: "both" }}
    />
  );
}
