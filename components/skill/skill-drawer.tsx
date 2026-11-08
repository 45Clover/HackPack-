"use client";
// The bottom drawer the Learning guide opens in: 87% of the screen tall, 90% wide, scrolls inside. Closing it (the X,
// Escape, or a click on the dimmed map) goes back in history, so the URL returns to where you were.
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function SkillDrawer({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Sheet open onOpenChange={(open) => !open && router.back()}>
      <SheetContent
        side="bottom"
        className="data-[side=bottom]:h-[87svh] gap-0 overflow-y-auto overscroll-contain rounded-t-[2rem] border-0 bg-background px-4 pt-10 sm:px-8 data-[side=bottom]:inset-x-[5vw] data-[side=bottom]:data-starting-style:translate-y-full data-[side=bottom]:data-ending-style:translate-y-full duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:duration-300"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <span aria-hidden className="absolute top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-foreground/15" />
        {children}
      </SheetContent>
    </Sheet>
  );
}
