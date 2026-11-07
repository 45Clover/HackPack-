"use client";
// The signed-in dashboard: the 3D constellation fills the screen (content layer),
// and three pieces of Liquid Glass float above it (functional layer): left panel, right panel, and the card on the selected node.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeftIcon, ArrowUpRightIcon, BookmarkIcon, BookmarkCheckIcon, CheckIcon, SlidersHorizontalIcon, XIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScopeSwitch } from "@/components/scope-switch";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import { ago } from "@/lib/ago";
import type { GraphJob, GraphLink, Leader, MySkill, SavedJob } from "@/lib/dashboard";
import type { Scope } from "@/lib/scope";
import type { GLink, GNode } from "./graph-3d";
import { GraphBoundary } from "./graph-boundary";

const Graph3D = dynamic(() => import("./graph-3d"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 grid place-items-center text-sm text-muted-foreground">Mapping your constellation…</div>,
});

type Skill = { id: number; slug: string; name: string; category: string | null };

const onResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
type Props = {
  user: { name: string; picture: string | null };
  role: string;
  scope: Scope;
  cities: string[];
  mine: MySkill[];
  jobs: GraphJob[];
  links: GraphLink[];
  leaders: Leader[];
  saved: SavedJob[];
  started: MySkill[];
  persist: boolean; // false on /preview: changes stay in the browser
  initialFocus?: string; // e.g. "s:react" or "j:<job id>": open with that node selected
};

export function DashboardShell({ user, role, scope, cities, mine, jobs, links, leaders, saved: initialSaved, started, persist, initialFocus }: Props) {
  const router = useRouter();
  const skills = useMemo(() => {
    const m = new Map<string, Skill>();
    for (const s of [...mine, ...started]) m.set(s.slug, s);
    for (const l of links) m.set(l.slug, { id: l.skill_id, slug: l.slug, name: l.name, category: l.category });
    return m;
  }, [mine, started, links]);

  const [have, setHave] = useState(() => new Set([...mine.map((s) => s.slug), ...links.filter((l) => l.has).map((l) => l.slug)]));
  const [learning, setLearning] = useState(() => new Set(started.map((s) => s.slug)));
  const [saved, setSaved] = useState(initialSaved);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [focusId] = useState(initialFocus ?? null);
  const [tab, setTab] = useState<"skills" | "jobs">("skills");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  // The graph: you → your skills; each job → the skills it asks for.
  const data = useMemo(() => {
    const nodes = new Map<string, GNode>([["me", { id: "me", kind: "me", label: "You", fx: 0, fy: 0, fz: 0 }]]);
    const edges: GLink[] = [];
    const addSkill = (s: Skill) => nodes.set(`s:${s.slug}`, { id: `s:${s.slug}`, kind: "skill", label: s.name, slug: s.slug, category: s.category });
    for (const s of mine) {
      addSkill(s);
      edges.push({ source: "me", target: `s:${s.slug}`, kind: "mine" });
    }
    for (const j of jobs) nodes.set(`j:${j.id}`, { id: `j:${j.id}`, kind: "job", label: `${j.title} · ${j.company}`, jobId: j.id });
    for (const l of links) {
      if (!nodes.has(`s:${l.slug}`)) addSkill({ id: l.skill_id, slug: l.slug, name: l.name, category: l.category });
      edges.push({ source: `j:${l.job_id}`, target: `s:${l.slug}`, kind: l.has ? "has" : "missing" });
    }
    return { nodes: [...nodes.values()], links: edges };
  }, [mine, jobs, links]);

  // Match scores and "next skill" follow what you've marked, live.
  const matchOf = (jobId: string) => {
    const req = links.filter((l) => l.job_id === jobId && l.required);
    return { have: req.filter((l) => have.has(l.slug)).length, needed: req.length };
  };
  const nextSkill = useMemo(() => {
    const count = new Map<string, number>();
    for (const l of links) if (l.required && !have.has(l.slug)) count.set(l.slug, (count.get(l.slug) ?? 0) + 1);
    const [slug, n] = [...count].sort((a, b) => b[1] - a[1])[0] ?? [];
    return slug ? { skill: skills.get(slug)!, jobs: n } : null;
  }, [links, have, skills]);

  // The constellation fills the window.
  const width = useSyncExternalStore(onResize, () => window.innerWidth, () => 1280);
  const height = useSyncExternalStore(onResize, () => window.innerHeight, () => 800);

  async function persistCall(url: string, body: object) {
    if (!persist) return true;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res?.ok) setError("That didn't save. Check your connection and try again.");
    return !!res?.ok;
  }

  async function setSkillStatus(slug: string, status: "have" | "learning" | "none") {
    const skill = skills.get(slug);
    if (!skill) return;
    const before = { have: new Set(have), learning: new Set(learning) };
    const nextHave = new Set(have), nextLearning = new Set(learning);
    nextHave.delete(slug);
    nextLearning.delete(slug);
    if (status === "have") nextHave.add(slug);
    if (status === "learning") nextLearning.add(slug);
    setHave(nextHave);
    setLearning(nextLearning);
    if (!(await persistCall("/api/skill-status", { skillId: skill.id, status }))) {
      setHave(before.have);
      setLearning(before.learning);
    }
  }

  async function toggleSaved(job: GraphJob) {
    const isSaved = saved.some((s) => s.id === job.id);
    const before = saved;
    setSaved(isSaved ? saved.filter((s) => s.id !== job.id) : [{ id: job.id, title: job.title, company: job.company, url: job.url }, ...saved]);
    if (!(await persistCall("/api/saved", { jobId: job.id, saved: !isSaved }))) setSaved(before);
  }

  const select = (id: string) => setSelected(data.nodes.find((n) => n.id === id) ?? null);
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => setSelected(data.nodes.find((n) => n.id === focusId) ?? null), 2500); // after the layout settles
    return () => clearTimeout(t);
  }, [focusId, data]);
  const selectedJob = selected?.kind === "job" ? jobs.find((j) => j.id === selected.jobId) ?? null : null;
  const selectedSkill = selected?.kind === "skill" && selected.slug ? skills.get(selected.slug) ?? null : null;
  const visibleLeaders = leaders.filter((l) => !hidden.has(l.category ?? ""));
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const card = selectedJob ? (
    <JobCard job={selectedJob} match={matchOf(selectedJob.id)} isSaved={saved.some((s) => s.id === selectedJob.id)} onSave={() => toggleSaved(selectedJob)} />
  ) : selectedSkill ? (
    <SkillCard skill={selectedSkill} status={have.has(selectedSkill.slug) ? "have" : learning.has(selectedSkill.slug) ? "learning" : "none"} onStatus={(s) => setSkillStatus(selectedSkill.slug, s)} />
  ) : null;

  return (
    <>
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <GraphBoundary>
          <Graph3D data={data} have={have} learning={learning} hidden={hidden} selectedId={selected?.id ?? null} onSelect={setSelected} card={card} width={width} height={height} />
        </GraphBoundary>
      </div>

      {/* Mobile: the panels stack over the graph. Desktop: they slide out from the screen edges (Saagii's mockup). */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-4 lg:contents">
        {/* LEFT: one white card (you, saved, started) and one solid black card (next skill). No cards inside cards. */}
        <div className="flex flex-col gap-4 lg:fixed lg:top-[122px] lg:bottom-0 lg:left-0 lg:w-[clamp(250px,18.6vw,330px)] lg:gap-[30px]">
        <section className="surface rise-in pointer-events-auto flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 lg:rounded-l-none lg:rounded-r-[40px]">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {user.picture && <AvatarImage src={user.picture} alt="" />}
              <AvatarFallback className="bg-secondary text-sm font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xl leading-tight font-medium tracking-tight break-words">{user.name}</p>
              <p className="text-sm text-muted-foreground">{role} · {scope.kind === "canada" ? "Canada" : scope.city}</p>
            </div>
          </div>

          <dl className="flex justify-between border-y border-border py-4">
            {([["Skills", have.size], ["Saved", saved.length], ["Started", learning.size]] as const).map(([label, n]) => (
              <div key={label}>
                <dd className="text-[28px] leading-none font-medium tracking-tight tabular-nums">{n}</dd>
                <dt className="eyebrow mt-1.5">{label}</dt>
              </div>
            ))}
          </dl>

          <PanelList title="Saved" count={saved.length} empty="Save jobs from the graph to keep them here.">
            {saved.map((s) => (
              <li key={s.id} className="flex items-start gap-2.5">
                <button aria-label={`Unsave ${s.title}`} className="mt-0.5 text-[var(--blue)] hover:opacity-70" onClick={() => {
                  const job = jobs.find((j) => j.id === s.id);
                  if (job) toggleSaved(job);
                  else setSaved(saved.filter((x) => x.id !== s.id));
                }}><BookmarkCheckIcon className="size-4" /></button>
                <button className="min-w-0 text-left" onClick={() => (data.nodes.some((n) => n.id === `j:${s.id}`) ? select(`j:${s.id}`) : window.open(s.url, "_blank", "noopener"))}>
                  <span className="block truncate text-sm">{s.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.company}</span>
                </button>
              </li>
            ))}
          </PanelList>

          <PanelList title="Started" count={learning.size} empty="Start a skill from its card, then tick it off once you've learned it.">
            {[...learning].map((slug) => skills.get(slug)).filter((s): s is Skill => !!s).map((s) => (
              <li key={s.slug} className="flex items-center gap-2.5">
                <button
                  aria-label={`Mark ${s.name} as learned`}
                  className="size-4 shrink-0 rounded-[5px] border-[1.5px] border-foreground/30 hover:border-[var(--have)] hover:bg-[var(--have)]/15"
                  onClick={() => setSkillStatus(s.slug, "have")}
                />
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" onClick={() => select(`s:${s.slug}`)}>
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(s.category) }} />
                  <span className="truncate">{s.name}</span>
                </button>
                <button aria-label={`Stop learning ${s.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setSkillStatus(s.slug, "none")}><XIcon className="size-3.5" /></button>
              </li>
            ))}
          </PanelList>

          <Link href="/onboarding" className="mt-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Edit skills &amp; resume</Link>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </section>

        {nextSkill && (
          <section className="surface-ink rise-in pointer-events-auto shrink-0 space-y-3 p-6 lg:rounded-none lg:rounded-tr-[40px]">
            <p className="text-sm text-white/60">Next skill</p>
            <p className="text-[40px] leading-[1.05] font-medium tracking-tight">{nextSkill.skill.name}</p>
            <p className="text-sm text-white/60">Asked for in {nextSkill.jobs} of your closest jobs</p>
            <button
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition-transform active:scale-[0.98]"
              onClick={() => select(`s:${nextSkill.skill.slug}`)}
            >
              Show me where
            </button>
          </section>
        )}
        </div>

        <div className="contents">
          <div className="pointer-events-none hidden text-center lg:fixed lg:inset-x-0 lg:top-[68px] lg:block">
            <h1 className="text-2xl font-medium tracking-tight">Your skill map</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {scope.kind === "canada" ? "Canada" : scope.city} · {jobs.length} closest jobs · {have.size} skills
            </p>
          </div>
          <nav aria-label="Focus one category" className="surface pointer-events-auto hidden max-w-[calc(100vw-clamp(250px,18.6vw,330px)-clamp(270px,19.8vw,350px)-48px)] items-center gap-0.5 overflow-x-auto rounded-full p-1.5 [scrollbar-width:none] lg:fixed lg:bottom-5 lg:left-1/2 lg:flex lg:-translate-x-1/2">
            {[{ slug: "all", name: "All" }, ...CATEGORIES.filter((c) => [...skills.values()].some((sk) => sk.category === c.slug))].map((c) => {
              const active = c.slug === "all" ? hidden.size === 0 : hidden.size === CATEGORIES.length - 1 && !hidden.has(c.slug);
              return (
                <button
                  key={c.slug}
                  aria-pressed={active}
                  onClick={() => setHidden(c.slug === "all" ? new Set() : new Set(CATEGORIES.filter((x) => x.slug !== c.slug).map((x) => x.slug)))}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] transition-colors ${active ? "bg-[var(--ink)] text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                >
                  {c.slug !== "all" && <span aria-hidden className="size-2 rounded-full" style={{ background: "color" in c ? c.color : undefined }} />}
                  {c.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* RIGHT: leaderboard / closest jobs, or "overall info" for the selected node */}
        <aside className="surface rise-in pointer-events-auto flex flex-col gap-5 overflow-y-auto p-6 lg:fixed lg:top-[122px] lg:right-0 lg:bottom-0 lg:w-[clamp(270px,19.8vw,350px)] lg:rounded-none lg:rounded-tl-[40px]">
          <div className="flex items-center justify-between gap-2">
            {selected ? (
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>
                <ArrowLeftIcon className="size-4" />Overall info
              </button>
            ) : (
              <h2 className="text-xl font-medium tracking-tight">Leaderboard</h2>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Filter categories">
                <SlidersHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Show categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CATEGORIES.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.slug}
                    closeOnClick={false}
                    checked={!hidden.has(c.slug)}
                    onCheckedChange={(on) => setHidden((h) => { const n = new Set(h); if (on) n.delete(c.slug); else n.add(c.slug); return n; })}
                  >
                    <span aria-hidden className="size-2 rounded-full" style={{ background: c.color }} />{c.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {selectedJob ? (
            <JobInfo job={selectedJob} links={links.filter((l) => l.job_id === selectedJob.id)} have={have} onSkill={(slug) => select(`s:${slug}`)} />
          ) : selectedSkill ? (
            <SkillInfo skill={selectedSkill} leader={leaders.find((l) => l.slug === selectedSkill.slug)} jobs={jobs.filter((j) => links.some((l) => l.job_id === j.id && l.slug === selectedSkill.slug))} onJob={(id) => select(`j:${id}`)} />
          ) : (
            <>
              <ScopeSwitch scope={scope} cities={cities} />
              <ToggleGroup aria-label="List" value={[tab]} onValueChange={(v) => v[0] && setTab(v[0] as "skills" | "jobs")} className="w-full">
                <ToggleGroupItem value="skills" className="flex-1">Top skills</ToggleGroupItem>
                <ToggleGroupItem value="jobs" className="flex-1">Closest jobs</ToggleGroupItem>
              </ToggleGroup>
              {tab === "skills" ? (
                <ol className="space-y-3">
                  {visibleLeaders.map((l, i) => (
                    <li key={l.slug}>
                      <button className="flex w-full items-center gap-2.5 text-left text-sm" onClick={() => (data.nodes.some((n) => n.id === `s:${l.slug}`) ? select(`s:${l.slug}`) : router.push(`/skills/${l.slug}`))}>
                        <span className="w-4 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                        <span className="flex-1 truncate">{l.name}</span>
                        {have.has(l.slug) && <CheckIcon className="size-3.5 text-[var(--have)]" aria-label="You have this" />}
                        <span className="font-mono text-xs text-muted-foreground">{l.jobs}</span>
                      </button>
                      <div className="mt-1.5 ml-6.5 h-[3px] rounded-full bg-secondary" aria-hidden>
                        <div className="h-full rounded-full" style={{ width: `${(l.jobs / (visibleLeaders[0]?.jobs || 1)) * 100}%`, background: categoryColor(l.category) }} />
                      </div>
                    </li>
                  ))}
                  {visibleLeaders.length === 0 && <p className="text-sm text-muted-foreground">No skills in the categories you picked.</p>}
                </ol>
              ) : (
                <ul className="space-y-1">
                  {jobs.map((j) => {
                    const m = matchOf(j.id);
                    return (
                      <li key={j.id}>
                        <button className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary" onClick={() => select(`j:${j.id}`)}>
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{j.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{j.company} · {j.remote ? "Remote" : j.city}</span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{m.have}/{m.needed}</span>
                        </button>
                      </li>
                    );
                  })}
                  {jobs.length === 0 && <p className="text-sm text-muted-foreground">No close matches yet. Add skills, or switch to all of Canada.</p>}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function PanelList({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline justify-between text-sm font-medium">
        {title}<span className="text-muted-foreground tabular-nums">{count}</span>
      </h2>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="space-y-2.5">{children}</ul>}
    </section>
  );
}

// ---- The card that floats beside the selected node ----
function FloatingCard({ children }: { children: React.ReactNode }) {
  // The host sits on the node. .float-wrap shifts the card 64px to one side (globals.css flips it by data-side)
  // and draws the leader line back to the node.
  return (
    <div className="float-wrap">
      <span aria-hidden className="float-line" />
      <span aria-hidden className="float-dot" />
      <div className="surface w-80 space-y-4 p-6 text-sm text-foreground">{children}</div>
    </div>
  );
}

function MatchBar({ have, needed }: { have: number; needed: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground"><span>Must-have skills you have</span><span className="font-mono">{have}/{needed}</span></div>
      <div className="h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-[var(--blue)]" style={{ width: `${needed ? (have / needed) * 100 : 0}%` }} /></div>
    </div>
  );
}

function JobCard({ job, match, isSaved, onSave }: { job: GraphJob; match: { have: number; needed: number }; isSaved: boolean; onSave: () => void }) {
  return (
    <FloatingCard>
      <div>
        <p className="eyebrow">{job.company}</p>
        <p className="mt-1 text-base font-semibold leading-snug tracking-tight">{job.title}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 border-y border-border py-3">
        <div><dt className="eyebrow">Where</dt><dd className="mt-1 truncate">{job.remote ? "Remote" : job.city}</dd></div>
        <div><dt className="eyebrow">Posted</dt><dd className="mt-1 truncate">{ago(job.posted_at).replace(" ago", "")}</dd></div>
        <div><dt className="eyebrow">Match</dt><dd className="mt-1 font-mono">{match.have}/{match.needed}</dd></div>
      </dl>
      <MatchBar {...match} />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onSave} className="active:scale-[0.98]">
          {isSaved ? <BookmarkCheckIcon /> : <BookmarkIcon />}{isSaved ? "Saved" : "Save"}
        </Button>
        <a href={job.url} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "ghost" })}>Job post<ArrowUpRightIcon /></a>
      </div>
    </FloatingCard>
  );
}

function SkillCard({ skill, status, onStatus }: { skill: Skill; status: "have" | "learning" | "none"; onStatus: (s: "have" | "learning" | "none") => void }) {
  const category = CATEGORIES.find((c) => c.slug === skill.category)?.name ?? "Skill";
  return (
    <FloatingCard>
      <div>
        <p className="flex items-center gap-2 font-semibold"><span aria-hidden className="size-2 rounded-full" style={{ background: categoryColor(skill.category) }} />{skill.name}</p>
        <p className="text-muted-foreground">{category} · {status === "have" ? "on your resume" : status === "learning" ? "you're learning it" : "not on your resume yet"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "none" && <Button size="sm" onClick={() => onStatus("learning")} className="active:scale-[0.98]">Start learning</Button>}
        {status === "learning" && <Button size="sm" onClick={() => onStatus("have")} className="active:scale-[0.98]"><CheckIcon />I&apos;ve learned it</Button>}
        <Link href={`/skills/${skill.slug}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>Where to learn<ArrowUpRightIcon /></Link>
      </div>
    </FloatingCard>
  );
}

// ---- "Overall info" in the right panel ----
function JobInfo({ job, links, have, onSkill }: { job: GraphJob; links: GraphLink[]; have: Set<string>; onSkill: (slug: string) => void }) {
  const req = links.filter((l) => l.required), bonus = links.filter((l) => !l.required);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-snug tracking-tight">{job.title}</h2>
        <p className="text-sm text-muted-foreground">{job.company} · {job.remote ? "Remote in Canada" : job.city} · posted {ago(job.posted_at)}</p>
      </div>
      <MatchBar have={req.filter((l) => have.has(l.slug)).length} needed={req.length} />
      <SkillChips title="Must-have" items={req} have={have} onSkill={onSkill} />
      <SkillChips title="Nice to have" items={bonus} have={have} onSkill={onSkill} />
      <a href={job.url} target="_blank" rel="noreferrer" className={buttonVariants({ className: "w-full" })}>Open the job post<ArrowUpRightIcon /></a>
    </div>
  );
}

function SkillInfo({ skill, leader, jobs, onJob }: { skill: Skill; leader?: Leader; jobs: GraphJob[]; onJob: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{skill.name}</h2>
        <p className="text-sm text-muted-foreground">{CATEGORIES.find((c) => c.slug === skill.category)?.name ?? "Skill"}{leader && ` · in ${leader.jobs} job posts near you`}</p>
      </div>
      <section className="space-y-2">
        <h3 className="border-b border-border pb-2 text-sm font-medium">Your closest jobs that ask for it</h3>
        <ul className="space-y-1">
          {jobs.map((j) => (
            <li key={j.id}>
              <button className="w-full rounded-xl px-2 py-1.5 text-left hover:bg-secondary" onClick={() => onJob(j.id)}>
                <span className="block truncate text-sm">{j.title}</span>
                <span className="block text-xs text-muted-foreground">{j.company}</span>
              </button>
            </li>
          ))}
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">None of your closest jobs ask for it.</p>}
        </ul>
      </section>
      <Link href={`/skills/${skill.slug}`} className={buttonVariants({ variant: "secondary", className: "w-full" })}>Who&apos;s hiring, trend &amp; where to learn</Link>
    </div>
  );
}

function SkillChips({ title, items, have, onSkill }: { title: string; items: GraphLink[]; have: Set<string>; onSkill: (slug: string) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((l) => (
          <button key={l.slug} onClick={() => onSkill(l.slug)}>
            <Badge variant="secondary" className={`gap-1.5 ${have.has(l.slug) ? "" : "text-muted-foreground"}`}>
              {have.has(l.slug) ? <CheckIcon className="size-3 text-[var(--have)]" /> : <span aria-hidden className="size-1.5 rounded-full" style={{ background: categoryColor(l.category) }} />}
              {l.name}
            </Badge>
          </button>
        ))}
      </div>
    </section>
  );
}
