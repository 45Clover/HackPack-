import Link from "next/link";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ago } from "@/lib/ago";

export type SkillRow = { slug: string; name: string; jobs: number; companies: number; latest: Date };

// The accessible twin of the graph: same data, keyboard and screen-reader friendly.
export function SkillTable({ skills }: { skills: SkillRow[] }) {
  return (
    <Table>
      <TableCaption>Skills asked for in job posts from the last 60 days.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Skill</TableHead>
          <TableHead className="text-right">Job posts</TableHead>
          <TableHead className="text-right">Companies</TableHead>
          <TableHead>Newest post</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {skills.map((s) => (
          <TableRow key={s.slug}>
            <TableCell><Link className="underline-offset-4 hover:underline" href={`/skills/${s.slug}`}>{s.name}</Link></TableCell>
            <TableCell className="text-right tabular-nums">{s.jobs}</TableCell>
            <TableCell className="text-right tabular-nums">{s.companies}</TableCell>
            <TableCell>{ago(s.latest)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
