"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpIcon, ListChecksIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { categoryColor } from "@/lib/categories";
import { ROLES, roleBySlug } from "@/lib/roles";
import { BrandPanel } from "@/components/brand-panel";

type Skill = { id: number; slug: string; name: string; category: string | null };
// No firstName = a guest (not signed in). Their answers go to a cookie, not the database.
type Props = { firstName?: string; skills: Skill[]; cities: string[]; initial: { skillIds: number[]; role: string; city: string } };

const STEPS = ["start", "skills", "role", "city"] as const;
const TOP = 20; // "the 20 skills job posts ask for most": `skills` arrives sorted by job count

// 50/50 split: your map building itself on the left, one question at a time on the right.
// Start → resume upload OR answer by hand → check skills → target role → city.
export function OnboardingFlow({ firstName, skills, cities, initial }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [fromResume, setFromResume] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set(initial.skillIds));
  const [role, setRole] = useState(initial.role);
  const [city, setCity] = useState(initial.city);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<{ busy: boolean; message: string }>({ busy: false, message: "" });

  const saved = initial.skillIds.length > 0; // back to edit: show your answers on the left from the start
  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const top = skills.slice(0, TOP);
  const haveTop = top.filter((s) => picked.has(s.id)).length;
  // Picked skills outside the top 20 (from search or the resume) get their own row.
  const extras = [...picked].map((id) => byId.get(id)).filter((s): s is Skill => !!s && !top.includes(s));
  const q = query.trim().toLowerCase();
  const matches = q ? skills.filter((s) => !picked.has(s.id) && s.name.toLowerCase().includes(q)).slice(0, 8) : [];
  const toggle = (id: number) => setPicked((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });
  const go = (to: number) => { setStatus({ busy: false, message: "" }); setStep(to); };

  async function uploadResume(file: File) {
    setStatus({ busy: true, message: "Reading your resume…" });
    const body = new FormData();
    body.append("resume", file);
    const res = await fetch("/api/resume", { method: "POST", body }).catch(() => null);
    if (!res?.ok) return setStatus({ busy: false, message: res ? await res.text() : "Couldn't upload. Check your connection." });
    const { skills: found } = (await res.json()) as { skills: Skill[] };
    setPicked((prev) => new Set([...prev, ...found.map((s) => s.id)]));
    setFromResume(true);
    setStep(1);
    setStatus({ busy: false, message: `Found ${found.length} skills. Your file wasn't saved.` });
  }

  async function finish() {
    setStatus({ busy: true, message: "" });
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillIds: [...picked], targetRole: role, city }),
    }).catch(() => null);
    if (!res?.ok) return setStatus({ busy: false, message: "Couldn't save. Please try again." });
    router.push("/");
    router.refresh(); // re-read the server data so the dashboard sees your new answers
  }

  // Enter moves on. In the skills box, Enter adds the top match first.
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status.busy || step === 0) return; // the start screen is a choice, not a form
    if (STEPS[step] === "skills" && q) {
      if (matches[0]) { toggle(matches[0].id); setQuery(""); }
      return;
    }
    if (step === STEPS.length - 1) return void finish();
    go(step + 1);
  }

  const copy = {
    start: [
      firstName ? `Hi ${firstName}, let's map your skills.` : "See your skill map in about a minute.",
      `4 quick steps. We only ask what shapes your map: your skills, the role you want, and your city.${firstName ? "" : " No account needed."}`,
    ],
    skills: fromResume
      ? ["Check your skills", "We found these on your resume. Remove anything that's wrong and add what we missed."]
      : ["What have you used?", "Tap the ones you've worked with, even in a class or a side project."],
    role: ["What role are you aiming for?", "We use it to pick the jobs you're closest to. Not sure? Any tech role works."],
    city: ["Where do you want to work?", "Jobs in your city show first, plus remote jobs in Canada. You can switch to all of Canada later."],
  }[STEPS[step]];

  return (
    <main className="fixed inset-0 z-40 grid overflow-y-auto bg-background md:grid-cols-2">
      <BrandPanel title="Your skill map, built from real job posts." note="Dots are the skills job posts ask for most. Yours light up as you pick them.">
        <AnswerMap nodes={[...top, ...extras]} picked={picked} role={step >= 2 || saved ? roleBySlug(role).name : null} city={step >= 3 || saved ? city : null} />
      </BrandPanel>

      <section className="flex min-h-dvh flex-col px-6 py-8 md:px-16 md:py-10">
        <div className="flex items-center gap-4">
          <span className="text-[15px] font-semibold tracking-tight md:hidden">HackPack</span>
          <Progress value={((step + 1) / STEPS.length) * 100} aria-label={`Step ${step + 1} of ${STEPS.length}`} className="ml-auto w-32 md:ml-0" />
          <span className="text-sm text-muted-foreground tabular-nums">{step + 1} / {STEPS.length}</span>
        </div>

        <form key={step} onSubmit={submit} className="rise-in my-auto w-full max-w-md space-y-6 py-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{copy[0]}</h1>
            <p className="text-muted-foreground">{copy[1]}</p>
          </div>

          {STEPS[step] === "start" && (
            <div className="grid gap-3">
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])}
              />
              <ChoiceButton
                icon={<FileUpIcon className="size-5" />}
                title="Upload my resume"
                detail="PDF, up to 5 MB. We read the skills in memory. The file is never saved and no AI reads it."
                disabled={status.busy}
                onClick={() => fileInput.current?.click()}
              />
              <ChoiceButton
                icon={<ListChecksIcon className="size-5" />}
                title="Answer a few questions"
                detail="Tap the skills you've used. No file needed."
                disabled={status.busy}
                onClick={() => { setFromResume(false); go(1); }}
              />
            </div>
          )}

          {STEPS[step] === "skills" && (
            <div className="space-y-5">
              {/* Honest head start: counted from real job posts, live as you tap. */}
              <p role="status" className="text-sm">
                {haveTop > 0 ? (
                  <>You already have <span className="font-semibold text-[var(--blue)] tabular-nums">{haveTop}</span> of the {top.length} skills job posts ask for most.</>
                ) : (
                  `These are the ${top.length} skills job posts ask for most.`
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {top.map((s) => (
                  <Toggle
                    key={s.id}
                    variant="outline"
                    size="sm"
                    pressed={picked.has(s.id)}
                    onPressedChange={() => toggle(s.id)}
                    className="h-8 gap-1.5 rounded-full px-3 transition-colors duration-300 aria-pressed:border-transparent aria-pressed:bg-[var(--ink)] aria-pressed:text-[#f4f3ef] aria-pressed:hover:bg-[var(--ink)]/85"
                  >
                    <span aria-hidden className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
                    {s.name}
                  </Toggle>
                ))}
              </div>

              <div className="space-y-2">
                <Input placeholder="Search for more, e.g. Rust" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search all skills" />
                {q && (
                  <div className="flex flex-wrap gap-1.5">
                    {matches.map((s) => (
                      <Button key={s.id} type="button" size="sm" variant="secondary" onClick={() => { toggle(s.id); setQuery(""); }}>+ {s.name}</Button>
                    ))}
                    {matches.length === 0 && <p className="text-sm text-muted-foreground">No job posts ask for &ldquo;{query.trim()}&rdquo; yet.</p>}
                  </div>
                )}
              </div>

              {extras.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Also on your list</p>
                  <div className="flex flex-wrap gap-1.5">
                    {extras.map((s) => (
                      <Badge key={s.id} variant="outline" className="gap-1.5 py-1">
                        <span aria-hidden className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
                        {s.name}
                        <button type="button" onClick={() => toggle(s.id)} aria-label={`Remove ${s.name}`}><XIcon className="size-3" /></button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {STEPS[step] === "role" && (
            <ToggleGroup aria-label="Target role" variant="outline" size="lg" className="flex-wrap justify-start gap-2" value={[role]}>
              {/* Picking a role is the whole answer, so move on right away. Tapping the default works too. */}
              {ROLES.map((r) => (
                <ToggleGroupItem
                  key={r.slug}
                  type="button"
                  value={r.slug}
                  onClick={() => { setRole(r.slug); go(step + 1); }}
                  className="rounded-full px-4 aria-pressed:bg-foreground aria-pressed:text-background"
                >
                  {r.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}

          {STEPS[step] === "city" && (
            <Select value={city} onValueChange={(c) => c && setCity(String(c))}>
              <SelectTrigger aria-label="Your city" className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...new Set([city, ...cities])].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {status.message && <p role="status" className="text-sm text-muted-foreground">{status.message}</p>}

          {step > 0 && (
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" disabled={status.busy} onClick={() => go(step - 1)}>Back</Button>
              <Button type="submit" disabled={status.busy}>{step === STEPS.length - 1 ? "See my skill map" : "Next"}</Button>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}

function ChoiceButton({ icon, title, detail, disabled, onClick }: { icon: React.ReactNode; title: string; detail: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" disabled={disabled} onClick={onClick} className="h-auto items-start justify-start gap-4 rounded-2xl bg-card p-5 text-left whitespace-normal">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="space-y-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm font-normal text-muted-foreground">{detail}</span>
      </span>
    </Button>
  );
}

// The left panel, live: you in the middle, the most-asked-for skills spiralling out (most asked = closest).
// The ones you pick fill in and link to you; your role and city appear once you answer them.
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const ease = "cubic-bezier(0.16, 1, 0.3, 1)";

function AnswerMap({ nodes, picked, role, city }: { nodes: Skill[]; picked: Set<number>; role: string | null; city: string | null }) {
  const shown = nodes.slice(0, 36);
  // Sunflower spiral, starting a little out so "You" keeps the middle. Rounded so server and browser draw the same.
  const k = 245 / Math.sqrt(shown.length + 2);
  const at = (i: number) => {
    const r = k * Math.sqrt(i + 2), a = (i + 2) * GOLDEN;
    return [Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a) * 0.86)];
  };

  return (
    <div className="relative z-10 my-8 flex min-h-0 flex-1 flex-col gap-8">
      <svg aria-hidden viewBox="-300 -270 600 540" className="min-h-0 w-full flex-1 overflow-visible">
        {shown.map((s, i) => {
          const [x, y] = at(i);
          return <line key={`l${s.id}`} x1={0} y1={0} x2={x} y2={y} stroke="#f4f3ef" strokeOpacity={picked.has(s.id) ? 0.22 : 0} className="transition-[stroke-opacity] duration-500 ease-out motion-reduce:transition-none" />;
        })}
        {shown.map((s, i) => {
          const [x, y] = at(i);
          const on = picked.has(s.id);
          return (
            <g key={s.id} style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform 0.7s ${ease}` }} className="motion-reduce:transition-none!">
              <circle r={7} fill="none" stroke="#f4f3ef" strokeOpacity={on ? 0 : 0.35} strokeWidth={1.5} className="transition-[stroke-opacity] duration-500 motion-reduce:transition-none" />
              <circle
                r={9}
                fill={categoryColor(s.category)}
                style={{ opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(0.6)", transformBox: "fill-box", transformOrigin: "center", transition: `opacity 0.5s ease-out, transform 0.6s ${ease}` }}
                className="motion-reduce:transition-none!"
              />
              <text y={25} textAnchor="middle" fontSize={12.5} fill="#f4f3ef" fillOpacity={on ? 0.95 : 0.32} className="transition-[fill-opacity] duration-500 motion-reduce:transition-none">{s.name}</text>
            </g>
          );
        })}
        <circle r={22} fill="none" stroke="var(--blue)" strokeOpacity={0.45} />
        <circle r={12} fill="var(--blue)" />
        <text y={40} textAnchor="middle" fontSize={13} fontWeight={600} fill="#f4f3ef">You</text>
      </svg>

      <dl className="grid grid-cols-3 gap-6 border-t border-white/10 pt-5">
        <Fact label="Skills" value={picked.size ? String(picked.size) : null} placeholder="Step 2" />
        <Fact label="Aiming for" value={role} placeholder="Step 3" />
        <Fact label="City" value={city} placeholder="Step 4" />
      </dl>
    </div>
  );
}

function Fact({ label, value, placeholder }: { label: string; value: string | null; placeholder: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#f4f3ef]/50">{label}</dt>
      {/* key: a new answer rises in */}
      <dd key={value ?? ""} className={`rise-in mt-1 truncate text-sm font-medium ${value ? "" : "text-[#f4f3ef]/35"}`}>{value ?? placeholder}</dd>
    </div>
  );
}
