"use client";
// Pre-registration: your email, who you are, and whether to hear about internships. Posts to /api/waitlist (db/010).
// On the landing page, /waitlist (the QR code at judging) and /joinearly; `source` says which one.
import { useId, useState } from "react";
import { WAITLIST_ROLES, type Source } from "@/lib/waitlist";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const field = "h-11 rounded-xl px-3.5 text-[15px] md:text-[15px]";

export function WaitlistForm({ source }: { source: Source }) {
  const id = useId();
  const [role, setRole] = useState<string | null>(null);
  const [internships, setInternships] = useState(false);
  const [state, setState] = useState<{ busy?: boolean; done?: boolean; error?: string }>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!role) return setState({ error: "Pick who you are." });
    const form = new FormData(e.currentTarget);
    setState({ busy: true });
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), role, internships, source, company: form.get("company") }),
    }).catch(() => null);
    if (!res?.ok) return setState({ error: res ? await res.text() : "Couldn't connect. Please try again." });
    setState({ done: true });
  }

  return (
    <div aria-live="polite">
      {state.done ? (
        <p className="text-lg font-semibold tracking-tight">You&apos;re on the list. We&apos;ll email you once when Skilltri opens.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-email`} className="text-sm font-medium">Email</label>
              <Input id={`${id}-email`} name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label id={`${id}-role`} className="text-sm font-medium">I am a…</label>
              <Select items={WAITLIST_ROLES} value={role} onValueChange={(v) => setRole(v ? String(v) : null)}>
                <SelectTrigger aria-labelledby={`${id}-role`} className={`${field} w-full pr-3 data-[size=default]:h-11`}>
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {WAITLIST_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-[15px]">
            <Checkbox checked={internships} onCheckedChange={setInternships} />
            Tell me when internships go live
          </label>

          {/* Honeypot: people never see it, form-filling bots fill it in. display:none, so browser autofill leaves it alone too. */}
          <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

          <div className="flex flex-col items-start gap-3">
            <Button type="submit" disabled={state.busy} className="h-11 px-5 text-[15px] active:scale-[0.97] max-sm:w-full">
              {state.busy ? "Joining…" : "Join the waitlist"}
            </Button>
            <p className="text-sm text-muted-foreground">We&apos;ll email you once when Skilltri opens. Nothing else, and we never share it.</p>
          </div>
        </form>
      )}
    </div>
  );
}
