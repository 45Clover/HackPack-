import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryColor } from "@/lib/categories";
import type { MySkill, NextSkill } from "@/lib/dashboard";

type Props = { user: { name: string; picture: string | null }; role: string; city: string; skills: MySkill[]; nextSkill: NextSkill };

export function ProfileCard({ user, role, city, skills, nextSkill }: Props) {
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Avatar className="size-10">
            {user.picture && <AvatarImage src={user.picture} alt="" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate">{user.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{role} · {city}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{skills.length} skills from your resume</p>
          <div className="flex flex-wrap gap-1">
            {skills.slice(0, 18).map((s) => (
              <Badge key={s.slug} variant="outline" className="gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
                {s.name}
              </Badge>
            ))}
          </div>
          <Link href="/onboarding" className="text-sm underline underline-offset-4">Edit skills</Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Next skill</CardTitle></CardHeader>
        <CardContent>
          {nextSkill ? (
            <Link href={`/skills/${nextSkill.slug}`} className="group flex items-center justify-between gap-2">
              <span>
                <span className="text-lg font-semibold">{nextSkill.name}</span>
                <span className="block text-sm text-muted-foreground">Asked for in {nextSkill.jobs} of your closest jobs</span>
              </span>
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Add a few skills and we&apos;ll show what to learn next.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
