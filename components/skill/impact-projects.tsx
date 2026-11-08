"use client";
// "Impact projects" on the Learning guide: a real Canadian problem from public data, and a project that helps
// with it while practising the skill. Gemini wrote the text ahead of time (labelled), from the numbers in `series` only.
// The sparkline is decoration for sighted readers; the caption and a hidden table carry the same numbers.
import { ArrowUpRightIcon } from "lucide-react";
import { Line, LineChart, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ImpactProject } from "@/lib/impact";

const fmt = (v: number, unit: string) =>
  unit === "%" ? `${v}%` : unit === "$" ? `$${v.toLocaleString("en-CA")}` : `${v.toLocaleString("en-CA")} ${unit}`;

function Sparkline({ p }: { p: ImpactProject }) {
  const first = p.series[0];
  const last = p.series[p.series.length - 1];
  return (
    <figure className="space-y-1.5">
      <figcaption className="text-xs text-muted-foreground">{p.dataset_title}</figcaption>
      <ChartContainer aria-hidden config={{ value: { label: p.unit, color: "var(--blue)" } }} className="aspect-auto h-14 w-full">
        <LineChart data={p.series} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
      <p aria-hidden className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>{first.period} · {fmt(first.value, p.unit)}</span>
        <span>{last.period} · {fmt(last.value, p.unit)}</span>
      </p>
      <table className="sr-only">
        <caption>{p.dataset_title}</caption>
        <thead><tr><th>Period</th><th>Value</th></tr></thead>
        <tbody>{p.series.map((s) => <tr key={s.period}><td>{s.period}</td><td>{fmt(s.value, p.unit)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export function ImpactProjects({ projects, skill }: { projects: ImpactProject[]; skill: string }) {
  if (projects.length === 0) return null;
  return (
    <section aria-labelledby="impact" className="space-y-5">
      <div data-reveal>
        <h2 id="impact" className="text-2xl font-medium tracking-tight">Impact projects</h2>
        <p className="text-muted-foreground">Real problems in Canada, from public data. Build something that helps, and prove {skill} while you do it.</p>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {projects.map((p) => (
          <li key={p.id} data-reveal className="surface flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" title="Gemini wrote this idea from the numbers below">AI-suggested</Badge>
              {p.sdg_goal && <Badge variant="secondary">UN SDG {p.sdg_goal}</Badge>}
            </div>
            <p className="text-lg leading-snug">{p.problem}</p>
            <Sparkline p={p} />
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="font-medium">What to build</dt>
                <dd className="mt-1 text-muted-foreground">{p.build}</dd>
              </div>
              <div>
                <dt className="font-medium">How it practises {skill}</dt>
                <dd className="mt-1 text-muted-foreground">{p.practice}</dd>
              </div>
              <div>
                <dt className="font-medium">Proof to submit</dt>
                <dd className="mt-1 text-muted-foreground">{p.proof}</dd>
              </div>
            </dl>
            <a
              href={p.dataset_url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "link", size: "sm", className: "mt-auto h-auto self-start px-0 text-muted-foreground hover:text-foreground" })}
            >
              Data: {p.source === "statcan" ? `Statistics Canada table ${p.dataset_id}` : `UN SDG indicator ${p.dataset_id}`}
              <ArrowUpRightIcon aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
