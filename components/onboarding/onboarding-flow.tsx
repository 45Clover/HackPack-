"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { categoryColor } from "@/lib/categories";
import { ROLES } from "@/lib/roles";

type Skill = { id: number; slug: string; name: string; category: string | null };
type Props = { firstName: string; skills: Skill[]; cities: string[]; initial: { skillIds: number[]; role: string; city: string } };

// Three steps: 1) resume → 2) confirm skills → 3) target role + city.
export function OnboardingFlow({ firstName, skills, cities, initial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<Set<number>>(new Set(initial.skillIds));
  const [role, setRole] = useState(initial.role);
  const [city, setCity] = useState(initial.city);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<{ busy: boolean; message: string }>({ busy: false, message: "" });

  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const suggestions = query.trim()
    ? skills.filter((s) => !picked.has(s.id) && s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];
  const toggle = (id: number) => setPicked((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });

  async function uploadResume(file: File) {
    setStatus({ busy: true, message: "Reading your resume…" });
    const body = new FormData();
    body.append("resume", file);
    const res = await fetch("/api/resume", { method: "POST", body });
    if (!res.ok) return setStatus({ busy: false, message: await res.text() });
    const { skills: found } = (await res.json()) as { skills: Skill[] };
    setPicked((prev) => new Set([...prev, ...found.map((s) => s.id)]));
    setStatus({ busy: false, message: `Found ${found.length} skills. Your file wasn't saved.` });
    setStep(2);
  }

  async function finish() {
    setStatus({ busy: true, message: "Saving…" });
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillIds: [...picked], targetRole: role, city }),
    });
    if (!res.ok) return setStatus({ busy: false, message: "Couldn't save. Please try again." });
    router.push("/");
    router.refresh(); // re-read the server data so the dashboard sees your new profile
  }

  return (
    <Card className="glass glass-in mt-6 border-0 bg-transparent">
      <CardHeader>
        <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        <CardTitle className="text-2xl">
          {step === 1 && `Hi ${firstName}, let's start with your resume`}
          {step === 2 && "Check your skills"}
          {step === 3 && "What are you aiming for?"}
        </CardTitle>
        <CardDescription>
          {step === 1 && "We read the skills from your PDF in memory. The file is never saved, and no AI reads it."}
          {step === 2 && "Remove anything that's wrong and add what we missed. These drive your graph."}
          {step === 3 && "We use this to pick the jobs you're closest to."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === 1 && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center hover:bg-muted/50">
            <FileUpIcon className="size-8 text-muted-foreground" />
            <span className="font-medium">Upload your resume (PDF, up to 5 MB)</span>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={status.busy}
              onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])}
            />
          </label>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {[...picked].map((id) => byId.get(id)).filter((s): s is Skill => !!s).map((s) => (
                <Badge key={s.id} variant="outline" className="gap-1.5 py-1">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
                  {s.name}
                  <button onClick={() => toggle(s.id)} aria-label={`Remove ${s.name}`}><XIcon className="size-3" /></button>
                </Badge>
              ))}
              {picked.size === 0 && <p className="text-sm text-muted-foreground">No skills yet. Search below to add some.</p>}
            </div>
            <Input placeholder="Add a skill, e.g. Python" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search skills" />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <Button key={s.id} size="sm" variant="secondary" onClick={() => { toggle(s.id); setQuery(""); }}>+ {s.name}</Button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <ToggleGroup aria-label="Target role" className="flex-wrap" value={[role]} onValueChange={(v) => v[0] && setRole(String(v[0]))}>
              {ROLES.map((r) => <ToggleGroupItem key={r.slug} value={r.slug}>{r.name}</ToggleGroupItem>)}
            </ToggleGroup>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Your city</p>
              <Select value={city} onValueChange={(c) => c && setCity(String(c))}>
                <SelectTrigger aria-label="Your city" className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...new Set([city, ...cities])].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {status.message && <p role="status" className="text-sm text-muted-foreground">{status.message}</p>}
      </CardContent>

      <CardFooter className="justify-between">
        <Button variant="ghost" disabled={step === 1 || status.busy} onClick={() => setStep(step - 1)}>Back</Button>
        {step < 3 ? (
          <Button disabled={status.busy} onClick={() => setStep(step + 1)}>{step === 1 ? "Skip, add skills by hand" : "Next"}</Button>
        ) : (
          <Button disabled={status.busy} onClick={finish}>See my graph</Button>
        )}
      </CardFooter>
    </Card>
  );
}
