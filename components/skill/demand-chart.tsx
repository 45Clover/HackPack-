"use client";
// Weekly demand for one skill as a line (shadcn chart on recharts). One series, so no legend: the card title names it.
// Hover shows a crosshair and the week's count; a hidden table carries the same numbers for screen readers.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type Week = { week: string; jobs: number }; // week = ISO date of the Monday

const short = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });

export function DemandChart({ weeks }: { weeks: Week[] }) {
  const rows = weeks.map((w) => ({ ...w, label: short(w.week) }));
  return (
    <>
      <ChartContainer config={{ jobs: { label: "Job posts", color: "var(--blue)" } }} className="aspect-auto h-64 w-full">
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: -12 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="rgb(20 20 19 / 0.06)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={28} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
          <ChartTooltip
            cursor={{ stroke: "rgb(20 20 19 / 0.2)", strokeWidth: 1 }}
            content={<ChartTooltipContent indicator="line" labelFormatter={(l) => `Week of ${l}`} />}
          />
          <Line
            dataKey="jobs"
            type="monotone"
            stroke="var(--color-jobs)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: "#fff" }}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </LineChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>Job posts asking for this skill, by week</caption>
        <thead><tr><th>Week of</th><th>Job posts</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.week}><td>{r.label}</td><td>{r.jobs}</td></tr>)}</tbody>
      </table>
    </>
  );
}
