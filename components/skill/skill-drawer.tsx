"use client";
// The bottom drawer the Learning guide opens in: 87% of the screen tall, 90% wide, scrolls inside. It's the layout of
// the intercepted route (app/@drawer/(.)skills), above a loading.tsx, so Next prefetches it with the link: the drawer
// opens on click and the guide streams in behind a skeleton.
// Motion is CSS (@starting-style to rise in, since Base UI skips its enter styles for a dialog that mounts open, and
// Base UI's ending style to drop away), not GSAP: transform transitions run on the compositor, so React
// mounting the guide can't stall them. Like a native sheet, it rises from below while the page behind is pushed back
// (globals.css, html[data-drawer]); closing drops it away faster, then we go back in history so the URL returns.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const html = () => document.documentElement;

export function SkillDrawer({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const [open, setOpen] = useState(true);
  const panel = useRef<HTMLDivElement>(null);

  // Pushing the page back means transforming it, which re-anchors its fixed panels: only safe when it isn't scrolled.
  useLayoutEffect(() => {
    if (window.scrollY < 4 && !matchMedia("(prefers-reduced-motion: reduce)").matches) html().dataset.drawer = "push";
    return () => void delete html().dataset.drawer; // if we leave some other way, never leave the page pushed back
  }, []);
  useEffect(() => panel.current?.scrollTo(0, 0), [slug]); // a "learn next" link swaps the guide inside the open drawer

  const close = (next: boolean) => {
    if (next) return;
    setOpen(false);
    if (html().dataset.drawer) html().dataset.drawer = "back"; // the page springs back while the drawer drops
  };

  return (
    <Sheet open={open} onOpenChange={close} onOpenChangeComplete={(o) => !o && router.back()}>
      <SheetContent
        ref={panel}
        side="bottom"
        // No backdrop blur: blurring the whole page every frame while it scales is what the GPU chokes on.
        overlayClassName="supports-backdrop-filter:backdrop-blur-none"
        className="transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:duration-250 motion-reduce:transition-none data-[side=bottom]:h-[87svh] gap-0 overflow-y-auto overscroll-contain rounded-t-[2rem] border-0 bg-background px-4 pt-10 shadow-[0_-24px_60px_-30px_rgb(20_20_19/0.45)] sm:px-8 data-[side=bottom]:inset-x-[5vw] data-[side=bottom]:starting:translate-y-full data-[side=bottom]:data-ending-style:translate-y-full data-starting-style:opacity-100 data-ending-style:opacity-100"
      >
        <SheetTitle className="sr-only">{`${slug} learning guide`}</SheetTitle>
        <span aria-hidden className="absolute top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-foreground/15" />
        {children}
      </SheetContent>
    </Sheet>
  );
}
