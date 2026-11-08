"use client";
// The inside of the dashboard's bottom bar: All + every category on the map, with short names so they fit.
// If they still don't fit (narrow screens), the edges fade and arrows scroll the rest into view.
import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type Cat = { slug: string; label: string; color?: string };

export function CategoryBar({ cats, active, onPick }: { cats: Cat[]; active: string | null; onPick: (slug: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setEdge({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [cats.length]);

  const nudge = (dir: number) => box.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  const fade = `linear-gradient(to right, ${edge.left ? "transparent, black 28px" : "black"}, ${edge.right ? "black calc(100% - 28px), transparent" : "black"})`;
  const arrow = "grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

  return (
    <>
      {edge.left && <button aria-label="Show earlier categories" className={arrow} onClick={() => nudge(-1)}><ChevronLeftIcon className="size-4" /></button>}
      <div ref={box} className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]" style={{ maskImage: fade }}>
        {cats.map((c) => (
          <button
            key={c.slug}
            aria-pressed={active === c.slug}
            onClick={() => onPick(c.slug)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] transition-colors ${active === c.slug ? "bg-[var(--ink)] text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            {c.color && <span aria-hidden className="size-2 rounded-full" style={{ background: c.color }} />}
            {c.label}
          </button>
        ))}
      </div>
      {edge.right && <button aria-label="Show more categories" className={arrow} onClick={() => nudge(1)}><ChevronRightIcon className="size-4" /></button>}
    </>
  );
}
