// The drawer frame for every Learning guide opened from inside the app. It sits above [slug]/loading.tsx, so it's
// prefetched with the link and opens on click; switching skills inside it swaps only the guide.
import { SkillDrawer } from "@/components/skill/skill-drawer";

export default function SkillDrawerLayout({ children }: { children: React.ReactNode }) {
  return <SkillDrawer>{children}</SkillDrawer>;
}
