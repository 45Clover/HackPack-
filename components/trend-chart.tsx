"use client";
import { Bar, BarChart, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export function TrendChart({ data }: { data: { week: Date; jobs: number }[] }) {
  const rows = data.map((d) => ({ week: new Date(d.week).toISOString().slice(5, 10), jobs: d.jobs }));
  return (
    <ChartContainer config={{ jobs: { label: "New job posts", color: "var(--chart-1)" } }} className="h-48 w-full">
      <BarChart data={rows} accessibilityLayer>
        <XAxis dataKey="week" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="jobs" fill="var(--color-jobs)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
