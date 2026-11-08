// The Learning guide as its own page: a shared link or a refresh lands here. Opened from inside the app it slides up
// as a drawer instead (app/@drawer/(.)skills/[slug]).
import { SkillGuide } from "@/components/skill/skill-guide";

export default async function SkillPage({ params, searchParams }: PageProps<"/skills/[slug]">) {
  const { slug } = await params;
  return <SkillGuide slug={slug} searchParams={await searchParams} />;
}
