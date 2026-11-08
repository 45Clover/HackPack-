// The left half of the 50/50 auth screens (onboarding, login): black panel, the HackPack name, the map's shapes
// drawn flat, and a headline. Hidden on phones, where the right half is the whole screen.
// `children` swaps the flat drawing for a live one (onboarding draws your answers there).
import { categoryColor } from "@/lib/categories";

export function BrandPanel({ title, note, children }: { title: string; note?: string; children?: React.ReactNode }) {
  return (
    <aside className="relative hidden flex-col overflow-hidden bg-[var(--ink)] p-10 text-[#f4f3ef] md:flex">
      <span className="relative z-10 text-[15px] font-semibold tracking-tight">HackPack</span>
      {children ?? <Constellation />}
      <div className="relative z-10 mt-auto max-w-md">
        <p className="text-4xl font-semibold leading-[1.1] tracking-tight">{title}</p>
        {note && <p className="mt-4 text-sm text-[#f4f3ef]/60">{note}</p>}
      </div>
    </aside>
  );
}

// The map's shapes, drawn flat: diamonds = jobs, filled dots = skills you have, rings = skills to learn.
const JOBS = [[120, 150], [335, 95], [385, 305], [175, 385], [300, 470]];
const SKILLS: [number, number, string][] = [
  [215, 205, "frontend"], [85, 265, "language"], [275, 250, "backend"], [410, 185, "database"],
  [330, 375, "cloud-devops"], [110, 470, "data-ai"], [230, 315, "language"], [430, 430, "mobile"],
];
const RINGS = [[165, 80, 0], [450, 255, 2], [245, 525, 4]]; // x, y, the job that asks for it
const LINKS = [[0, 0], [0, 1], [1, 0], [1, 3], [2, 2], [2, 3], [2, 4], [3, 6], [3, 5], [4, 4], [4, 7], [0, 6]];

function Constellation() {
  return (
    <div aria-hidden className="absolute inset-x-10 top-20 bottom-60">
      <svg viewBox="0 0 520 580" className="size-full">
        {LINKS.map(([j, s]) => (
          <line key={`${j}-${s}`} x1={JOBS[j][0]} y1={JOBS[j][1]} x2={SKILLS[s][0]} y2={SKILLS[s][1]} stroke="#f4f3ef" strokeOpacity={0.14} />
        ))}
        {RINGS.map(([x, y, j]) => <line key={`r${x}`} x1={x} y1={y} x2={JOBS[j][0]} y2={JOBS[j][1]} stroke="#f4f3ef" strokeOpacity={0.14} strokeDasharray="3 5" />)}
        {JOBS.map(([x, y]) => <rect key={`j${x}`} x={x - 8} y={y - 8} width={16} height={16} transform={`rotate(45 ${x} ${y})`} fill="#f4f3ef" />)}
        {SKILLS.map(([x, y, c]) => <circle key={`s${x}`} cx={x} cy={y} r={9} fill={categoryColor(c)} />)}
        {RINGS.map(([x, y]) => <circle key={`o${x}`} cx={x} cy={y} r={8} fill="none" stroke="#f4f3ef" strokeOpacity={0.5} strokeWidth={1.5} />)}
      </svg>
    </div>
  );
}
