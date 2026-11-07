import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryColor } from "@/lib/categories";
import type { Leader } from "@/lib/dashboard";

// Most-asked-for skills in your area over the last 60 days. ✓ = you have it.
export function Leaderboard({ area, leaders }: { area: string; leaders: Leader[] }) {
  const top = leaders[0]?.jobs ?? 1;
  return (
    <Card>
      <CardHeader><CardTitle>Top skills in {area}</CardTitle></CardHeader>
      <CardContent>
        <ol className="space-y-2.5">
          {leaders.map((l, i) => (
            <li key={l.slug}>
              <Link href={`/skills/${l.slug}`} className="flex items-center gap-2 text-sm hover:underline">
                <span className="w-4 text-right tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate">{l.name}</span>
                {l.has && <CheckIcon className="size-3.5 text-emerald-400" aria-label="You have this" />}
                <span className="tabular-nums text-muted-foreground">{l.jobs}</span>
              </Link>
              <div className="ml-6 mt-1 h-1 rounded-full bg-muted" aria-hidden>
                <div className="h-1 rounded-full" style={{ width: `${(l.jobs / top) * 100}%`, background: categoryColor(l.category) }} />
              </div>
            </li>
          ))}
        </ol>
        {leaders.length === 0 && <p className="text-sm text-muted-foreground">No job data yet.</p>}
      </CardContent>
    </Card>
  );
}
