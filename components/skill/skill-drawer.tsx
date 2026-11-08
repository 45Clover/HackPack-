"use client";
// The bottom drawer the Learning guide opens in: 87% of the screen tall, 90% wide, scrolls inside.
// Motion (GSAP), like a native sheet: it rises from below the screen while the page behind is pushed back (scales
// down, rounds its corners, a dark backdrop shows around it). Closing drops it away faster than it came in, the page
// springs back, then we go back in history so the URL returns to where you were.
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const calm = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
const shell = () => document.getElementById("app-shell");
// Pushing the page back means transforming it, which re-anchors its fixed panels: only safe when it isn't scrolled.
const canPush = () => window.scrollY < 4;
const restore = () => {
  const s = shell();
  if (s) gsap.set(s, { clearProps: "transform,borderRadius,overflow" });
  gsap.set(document.body, { clearProps: "backgroundColor" });
};

export function SkillDrawer({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement | null>(null);
  const entered = useRef(false);
  const closing = useRef(false);

  // The sheet mounts a moment after this component (it renders into a portal), so start the motion when it does:
  // the drawer rises and the page is pushed back in the same beat.
  const enter = useCallback((el: HTMLDivElement | null) => {
    panel.current = el;
    if (!el || entered.current || !calm()) return;
    entered.current = true;
    gsap.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: "expo.out" });
    const s = shell();
    if (!s || !canPush()) return;
    gsap.set(document.body, { backgroundColor: "#141413" });
    gsap.to(s, { scale: 0.94, y: 10, borderRadius: 28, overflow: "hidden", transformOrigin: "50% 0%", duration: 0.6, ease: "expo.out" });
  }, []);

  useEffect(() => restore, []); // if we leave some other way, never leave the page pushed back

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (!calm()) return void (restore(), router.back());
    const s = shell();
    if (s && gsap.getProperty(s, "scale") !== 1) gsap.to(s, { scale: 1, y: 0, borderRadius: 0, duration: 0.3, ease: "power3.in", onComplete: restore });
    gsap.to(panel.current, { yPercent: 100, duration: 0.3, ease: "power3.in", onComplete: () => router.back() });
  };

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent
        ref={enter}
        side="bottom"
        // GSAP owns the slide: the sheet's CSS transition and Base UI's small slide/fade are off, or they re-ease every
        // frame GSAP sets and the drawer barely moves.
        className="transition-none data-[side=bottom]:h-[87svh] gap-0 overflow-y-auto overscroll-contain rounded-t-[2rem] border-0 bg-background px-4 pt-10 shadow-[0_-24px_60px_-30px_rgb(20_20_19/0.45)] sm:px-8 data-[side=bottom]:inset-x-[5vw] data-[side=bottom]:data-starting-style:translate-y-0 data-[side=bottom]:data-ending-style:translate-y-0 data-starting-style:opacity-100 data-ending-style:opacity-100"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <span aria-hidden className="absolute top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-foreground/15" />
        {children}
      </SheetContent>
    </Sheet>
  );
}
