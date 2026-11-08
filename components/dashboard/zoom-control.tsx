"use client";
// The zoom control on the right edge of the view: a small magnifying glass that opens into a vertical slider
// (+ and − at the ends) when you hover it or tab into it. 0–100; each view decides what that means.
import { useRef } from "react";
import gsap from "gsap";
import { MinusIcon, PlusIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import { Slider } from "@/components/ui/slider";

const OPEN = 240, SHUT = 44;
const calm = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

// `className` places it somewhere else, e.g. inside /explore's map instead of the dashboard's screen edge.
export function ZoomControl({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const open = (on: boolean) => {
    const el = box.current;
    if (!el) return;
    const d = calm() ? 0.45 : 0;
    gsap.to(el, { height: on ? OPEN : SHUT, duration: d, ease: "power3.out", overwrite: "auto" });
    gsap.to(el.querySelector("[data-icon]"), { opacity: on ? 0 : 1, duration: d * 0.6, overwrite: "auto" });
    gsap.to(el.querySelector("[data-controls]"), { opacity: on ? 1 : 0, duration: d, delay: on ? d * 0.3 : 0, overwrite: "auto" });
  };
  const step = (delta: number) => {
    const o = { v: value };
    gsap.to(o, { v: Math.min(100, Math.max(0, value + delta)), duration: calm() ? 0.4 : 0, ease: "power2.out", onUpdate: () => onChange(o.v) });
  };
  const button = "grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

  return (
    <div
      ref={box}
      role="group"
      aria-label="Zoom"
      onMouseEnter={() => open(true)}
      onMouseLeave={() => open(false)}
      onFocus={() => open(true)}
      onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node | null)) open(false); }}
      className={cn("surface pointer-events-auto fixed top-1/2 z-20 hidden w-11 -translate-y-1/2 overflow-hidden rounded-full lg:right-[calc(clamp(270px,19.8vw,350px)+16px)] lg:block", className)}
      style={{ height: SHUT }}
    >
      <SearchIcon data-icon aria-hidden className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
      <div data-controls className="absolute top-1/2 left-0 flex w-full -translate-y-1/2 flex-col items-center justify-between py-2 opacity-0" style={{ height: OPEN }}>
        <button aria-label="Zoom in" className={button} onClick={() => step(15)}><PlusIcon className="size-4" /></button>
        <Slider orientation="vertical" min={0} max={100} value={[value]} onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)} thumbLabel="Zoom" className="min-h-0 py-1" />
        <button aria-label="Zoom out" className={button} onClick={() => step(-15)}><MinusIcon className="size-4" /></button>
      </div>
    </div>
  );
}
