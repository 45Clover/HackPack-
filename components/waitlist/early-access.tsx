// One calm screen with just the waitlist form: /waitlist (the QR code at judging) and /joinearly.
// `source` records which link people came through.
import type { Source } from "@/lib/waitlist";
import { WaitlistForm } from "./waitlist-form";

export function EarlyAccess({ source }: { source: Source }) {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-120px)] w-full max-w-lg flex-col justify-center gap-8 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-[40px] leading-[1.04] font-semibold tracking-[-0.03em] text-balance">Get early access to Skilltri</h1>
        <p className="text-[17px] leading-relaxed text-muted-foreground">
          A live map of the tech skills Canadian companies are hiring for. It&apos;s in beta from Hack the Change 2026, and internships are coming.
        </p>
      </div>
      <div className="surface p-7">
        <WaitlistForm source={source} />
      </div>
    </main>
  );
}
