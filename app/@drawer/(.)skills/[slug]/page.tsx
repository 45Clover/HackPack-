// Clicking a Learning guide link inside the app (the Learning card, a skill's panel, the landing's top skills) opens it
// here, in a drawer over the current screen (the drawer itself is ../layout.tsx). The URL still changes to
// /skills/<slug>, so it can be shared or refreshed.
import { SkillGuide } from "@/components/skill/skill-guide";

export default async function SkillDrawerPage({ params, searchParams }: PageProps<"/skills/[slug]">) {
  const { slug } = await params;
  return <SkillGuide slug={slug} searchParams={await searchParams} inDrawer />;
}
