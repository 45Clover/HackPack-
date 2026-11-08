// /waitlist (the QR code at judging) and /joinearly: the same 50/50 split as sign-in and onboarding, the black brand
// panel on the left and just the waitlist form on the right. `source` records which link people came through.
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import type { Source } from "@/lib/waitlist";
import { BrandPanel } from "@/components/brand-panel";
import { buttonVariants } from "@/components/ui/button";
import { WaitlistForm } from "./waitlist-form";

export function EarlyAccess({ source }: { source: Source }) {
  return (
    <main className="fixed inset-0 z-40 grid overflow-y-auto bg-background md:grid-cols-2">
      <BrandPanel
        title="Be first in line."
        note="A live map of the tech skills Canadian companies are hiring for, built from real job posts. Internships and co-ops are coming next."
      />

      <section className="flex min-h-dvh flex-col px-6 py-8 md:px-16 md:py-10">
        <div className="flex items-center">
          <span className="text-[15px] font-semibold tracking-tight md:hidden">Skilltrii</span>
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm", className: "ml-auto text-muted-foreground md:-ml-2.5" })}>
            <ArrowLeftIcon /> Back
          </Link>
        </div>

        <div className="rise-in my-auto w-full max-w-md space-y-8 py-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Get early access to Skilltrii</h1>
            <p className="text-muted-foreground">It&apos;s in beta from Hack the Change 2026. Join and we&apos;ll tell you the day it opens.</p>
          </div>
          <WaitlistForm source={source} />
        </div>
      </section>
    </main>
  );
}
