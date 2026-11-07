"use client";
// The signed-in dashboard: the 3D constellation fills the screen (content layer),
// and three pieces of Liquid Glass float above it (functional layer): left panel, right panel, and the card on the selected node.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeftIcon, ArrowUpRightIcon, BookmarkIcon, BookmarkCheckIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, SlidersHorizontalIcon, XIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import { ago } from "@/lib/ago";
import type { GraphJob, GraphLink, Leader, MySkill, SavedJob } from "@/lib/dashboard";
import type { Scope } from "@/lib/scope";
import type { GLink, GNode } from "./graph-3d";
import { GraphBoundary } from "./graph-boundary";
import { SkillTree } from "./skill-tree";

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
  initialSidebarOpen?: boolean;
  initialView?: "map" | "tree";
};

export function DashboardShell({ user, role, scope, cities, mine, jobs, links, leaders, saved: initialSaved, started, persist, initialFocus, initialSidebarOpen = true, initialView = "map" }: Props) {
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
  const [leftOpen, setLeftOpen] = useState(initialSidebarOpen);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "tree">(initialView);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [projectUrl, setProjectUrl] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  // The 3D map: jobs and the skills they ask for. Your skills show as filled spheres; missing ones as rings.
  const data = useMemo(() => {
    const nodes = new Map<string, GNode>();
    const edges: GLink[] = [];
    for (const j of jobs) nodes.set(`j:${j.id}`, { id: `j:${j.id}`, kind: "job", label: `${j.title} · ${j.company}`, jobId: j.id });
    for (const l of links) {
      if (!nodes.has(`s:${l.slug}`)) nodes.set(`s:${l.slug}`, { id: `s:${l.slug}`, kind: "skill", label: l.name, slug: l.slug, category: l.category });
      edges.push({ source: `j:${l.job_id}`, target: `s:${l.slug}`, kind: l.has ? "has" : "missing" });
    }
    return { nodes: [...nodes.values()], links: edges };
  }, [jobs, links]);

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

  const jobCount = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of links) (m.get(l.slug) ?? m.set(l.slug, new Set()).get(l.slug)!).add(l.job_id);
    return new Map([...m].map(([slug, ids]) => [slug, ids.size]));
  }, [links]);

  // The constellation fills the window.
  const width = useSyncExternalStore(onResize, () => window.innerWidth, () => 1280);
  const height = useSyncExternalStore(onResize, () => window.innerHeight, () => 800);

  async function persistCall(url: string, body: object) {
    if (!persist) return true;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res?.ok) setError("That didn't save. Check your connection and try again.");
    return !!res?.ok;
  }

  async function setSkillStatus(slug: string, status: "have" | "learning" | "none", project?: string) {
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
    if (!(await persistCall("/api/skill-status", { skillId: skill.id, status, projectUrl: project }))) {
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
  const setArea = (kind: "city" | "canada", city = scope.city) => router.push(`?${new URLSearchParams({ scope: kind, city })}`);
  // Hovering a row lights up its node; keyboard focus does the same.
  const rowHover = (id: string) => ({
    onMouseEnter: () => setHoverId(id),
    onMouseLeave: () => setHoverId(null),
    onFocus: () => setHoverId(id),
    onBlur: () => setHoverId(null),
  });
  const startedList = [...learning];
  const learningNow = currentSlug && learning.has(currentSlug) ? currentSlug : startedList[startedList.length - 1] ?? null;
  const projectOk = /^https?:\/\/\S+\.\S+/.test(projectUrl.trim());
  async function finishLearning() {
    if (!learningNow || !projectOk) return;
    await setSkillStatus(learningNow, "have", projectUrl.trim());
    setProjectUrl("");
    setCurrentSlug(null);
  }
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => setSelected(data.nodes.find((n) => n.id === focusId) ?? null), 2500); // after the layout settles
    return () => clearTimeout(t);
  }, [focusId, data]);
  const selectedJob = selected?.kind === "job" ? jobs.find((j) => j.id === selected.jobId) ?? null : null;
  const selectedSkill = selected?.kind === "skill" && selected.slug ? skills.get(selected.slug) ?? null : null;
  const visibleLeaders = leaders.filter((l) => !hidden.has(l.category ?? ""));
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();


  const mini = (n: GNode) => {
    if (n.kind === "job") {
      const j = jobs.find((x) => x.id === n.jobId);
      const m = j ? matchOf(j.id) : null;
      return (
        <>
          <span className="block truncate font-medium">{j?.title}</span>
          <span className="block truncate text-muted-foreground">{j?.company}{m && ` · ${m.have}/${m.needed} skills`}</span>
        </>
      );
    }
    const owned = !!n.slug && have.has(n.slug);
    return (
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(n.category) }} />
        <span className="truncate font-medium">{n.label}</span>
        <span className={owned ? "text-[var(--have)]" : "text-muted-foreground"}>{owned ? "have" : "missing"}</span>
      </span>
    );
  };

  return (
    <>
      <div className="scene-bg fixed inset-0 z-0" aria-hidden="true">
        {view === "map" && (
        <GraphBoundary>
          <Graph3D data={data} have={have} learning={learning} hidden={hidden} selectedId={selected?.id ?? null} onSelect={setSelected} hoverId={hoverId} mini={mini} width={width} height={height} />
        </GraphBoundary>
        )}
      </div>

      {/* 2D view: the skill tree, in the space between the panels. */}
      {view === "tree" && (
        <div className="relative z-[5] flex flex-col-reverse overflow-auto lg:fixed lg:top-[132px] lg:right-[calc(clamp(270px,19.8vw,350px)+16px)] lg:bottom-[78px] lg:left-[calc(clamp(250px,18.6vw,330px)+16px)]">
          <SkillTree
            skills={[...skills.values()]}
            have={have}
            learning={learning}
            hidden={hidden}
            jobCount={jobCount}
            nextSlug={nextSkill?.skill.slug ?? null}
            selectedSlug={selectedSkill?.slug ?? null}
            onSelect={(slug) => select(`s:${slug}`)}
          />
        </div>
      )}

      {/* Mobile: the panels stack over the graph. Desktop: they slide out from the screen edges (Saagii's mockup). */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-4 lg:contents">
        {/* LEFT: the student card (collapsible) and the black Learning card (always there). No cards inside cards. */}
        <div className="flex flex-col gap-4 lg:fixed lg:top-[122px] lg:bottom-0 lg:left-0 lg:w-[clamp(250px,18.6vw,330px)] lg:gap-[30px]">
        <div className={`relative min-h-0 flex-1 lg:transition-transform lg:duration-500 lg:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${leftOpen ? "" : "lg:-translate-x-full"}`}>
        <section id="student-card" inert={!leftOpen} className="surface rise-in pointer-events-auto flex h-full flex-col gap-6 overflow-y-auto p-6 lg:rounded-l-none lg:rounded-r-[40px]">
          <div className="space-y-3">
            <div>
              <Avatar className="size-12">
                {user.picture && <AvatarImage src={user.picture} alt="" />}
                <AvatarFallback className="bg-secondary text-sm font-medium">{initials}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <p className="text-2xl leading-tight font-medium tracking-tight break-words">{user.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{role} · {scope.kind === "canada" ? "Canada" : scope.city}</p>
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

          <PanelList title="Started" count={learning.size} empty="Start a skill from its card. It stays in Learning until you finish it with a project.">
            {startedList.map((slug) => skills.get(slug)).filter((s): s is Skill => !!s).map((s) => (
              <li key={s.slug} className="flex items-center gap-2.5">
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                  aria-current={s.slug === learningNow}
                  onClick={() => { setCurrentSlug(s.slug); select(`s:${s.slug}`); }}
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(s.category) }} />
                  <span className={`truncate ${s.slug === learningNow ? "font-medium" : ""}`}>{s.name}</span>
                </button>
                <button aria-label={`Stop learning ${s.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setSkillStatus(s.slug, "none")}><XIcon className="size-3.5" /></button>
              </li>
            ))}
          </PanelList>

          <Link href="/onboarding" className="mt-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Edit skills &amp; resume</Link>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </section>
          {/* One chevron: rides on the card's edge, and stays at the screen edge when the card is tucked away. */}
          <button
            aria-label={leftOpen ? "Collapse your card" : "Expand your card"}
            aria-controls="student-card"
            aria-expanded={leftOpen}
            onClick={() => setLeftOpen(!leftOpen)}
            className={`surface pointer-events-auto absolute top-8 z-10 hidden size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground lg:grid ${leftOpen ? "-right-4" : "-right-12"}`}
          >
            {leftOpen ? <ChevronLeftIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
          </button>
        </div>
        {/* The black card: what you're learning now (finish it with a project), else the next skill to start. */}
        {learningNow && skills.get(learningNow) ? (
          <section className="surface-ink rise-in pointer-events-auto shrink-0 space-y-3 p-6 lg:rounded-none lg:rounded-tr-[40px]">
            <p className="text-sm text-white/60">Learning now</p>
            <p className="text-[40px] leading-[1.05] font-medium tracking-tight break-words">{skills.get(learningNow)!.name}</p>
            <p className="text-sm text-white/60">Finish it by sharing a project that uses it.</p>
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); finishLearning(); }}>
              <label htmlFor="project-url" className="sr-only">Project link</label>
              <Input
                id="project-url"
                type="url"
                inputMode="url"
                placeholder="https://github.com/you/project"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                className="h-10 rounded-full border-white/15 bg-white/10 px-4 text-white placeholder:text-white/40"
              />
              <button
                type="submit"
                disabled={!projectOk}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                I&apos;ve learned it
              </button>
            </form>
          </section>
        ) : nextSkill ? (
          <section className="surface-ink rise-in pointer-events-auto shrink-0 space-y-3 p-6 lg:rounded-none lg:rounded-tr-[40px]">
            <p className="text-sm text-white/60">Next skill</p>
            <p className="text-[40px] leading-[1.05] font-medium tracking-tight break-words">{nextSkill.skill.name}</p>
            <p className="text-sm text-white/60">Asked for in {nextSkill.jobs} of your closest jobs</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition-transform active:scale-[0.98]"
                onClick={() => { setSkillStatus(nextSkill.skill.slug, "learning"); setCurrentSlug(nextSkill.skill.slug); }}
              >
                Start learning
              </button>
              <button className="rounded-full px-3 py-2 text-sm text-white/70 hover:text-white" onClick={() => select(`s:${nextSkill.skill.slug}`)}>Show me where</button>
            </div>
          </section>
        ) : null}
        </div>

        <div className="contents">
          <div className="pointer-events-none hidden text-center lg:fixed lg:inset-x-0 lg:top-[68px] lg:block">
            <h1 className="text-2xl font-medium tracking-tight">Your skill map</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {scope.kind === "canada" ? "Canada" : scope.city} · {jobs.length} closest jobs · {have.size} skills
            </p>
          </div>
          {/* 3D map / Skill tree switch, bottom-right corner of the screen */}
          <div className="surface pointer-events-auto fixed right-5 bottom-5 z-20 hidden rounded-full p-1 lg:inline-flex" role="group" aria-label="View">
              {(["map", "tree"] as const).map((v) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${view === v ? "bg-[var(--ink)] text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "map" ? "3D map" : "Skill tree"}
                </button>
              ))}
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
        <aside className="surface rise-in pointer-events-auto flex flex-col gap-5 overflow-y-auto p-6 lg:fixed lg:top-[122px] lg:right-0 lg:bottom-0 lg:w-[clamp(270px,19.8vw,350px)] lg:rounded-none lg:rounded-tl-[40px] lg:pb-24">
          <div className="flex items-center justify-between gap-2">
            {selected ? (
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>
                <ArrowLeftIcon className="size-4" />Overall info
              </button>
            ) : (
              <div>
                <h2 className="text-xl font-medium tracking-tight">Leaderboard</h2>
                <p className="text-sm text-muted-foreground">{scope.kind === "canada" ? "All of Canada" : scope.city}</p>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Filter: area and categories">
                <SlidersHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>Area</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={scope.kind} onValueChange={(v) => setArea(v === "canada" ? "canada" : "city")}>
                  <DropdownMenuRadioItem value="city">{scope.city}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="canada">All of Canada</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {cities.length > 1 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Change city</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      <DropdownMenuRadioGroup value={scope.city} onValueChange={(c) => setArea("city", String(c))}>
                        {cities.map((c) => <DropdownMenuRadioItem key={c} value={c}>{c}</DropdownMenuRadioItem>)}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator />
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
            <JobInfo job={selectedJob} links={links.filter((l) => l.job_id === selectedJob.id)} have={have} onSkill={(slug) => select(`s:${slug}`)} isSaved={saved.some((x) => x.id === selectedJob.id)} onSave={() => toggleSaved(selectedJob)} />
          ) : selectedSkill ? (
            <SkillInfo
              skill={selectedSkill}
              leader={leaders.find((l) => l.slug === selectedSkill.slug)}
              jobs={jobs.filter((j) => links.some((l) => l.job_id === j.id && l.slug === selectedSkill.slug))}
              onJob={(id) => select(`j:${id}`)}
              status={have.has(selectedSkill.slug) ? "have" : learning.has(selectedSkill.slug) ? "learning" : "none"}
              onStart={() => { setSkillStatus(selectedSkill.slug, "learning"); setCurrentSlug(selectedSkill.slug); }}
              onFinish={() => { setCurrentSlug(selectedSkill.slug); document.getElementById("project-url")?.focus(); }}
            />
          ) : (
            <>
              <ToggleGroup aria-label="List" value={[tab]} onValueChange={(v) => v[0] && setTab(v[0] as "skills" | "jobs")} className="w-full">
                <ToggleGroupItem value="skills" className="flex-1">Top skills</ToggleGroupItem>
                <ToggleGroupItem value="jobs" className="flex-1">Closest jobs</ToggleGroupItem>
              </ToggleGroup>
              {tab === "skills" ? (
                <ol className="space-y-3">
                  {visibleLeaders.map((l, i) => (
                    <li key={l.slug}>
                      <button
                        className="flex w-full items-center gap-2.5 rounded-lg text-left text-sm"
                        {...rowHover(`s:${l.slug}`)}
                        onClick={() => { setHoverId(null); if (data.nodes.some((n) => n.id === `s:${l.slug}`)) select(`s:${l.slug}`); else router.push(`/skills/${l.slug}`); }}
                      >
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
                        <button className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary" {...rowHover(`j:${j.id}`)} onClick={() => { setHoverId(null); select(`j:${j.id}`); }}>
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

function MatchBar({ have, needed }: { have: number; needed: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground"><span>Must-have skills you have</span><span className="font-mono">{have}/{needed}</span></div>
      <div className="h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-[var(--blue)]" style={{ width: `${needed ? (have / needed) * 100 : 0}%` }} /></div>
    </div>
  );
}

// ---- "Overall info" in the right panel ----
function JobInfo({ job, links, have, onSkill, isSaved, onSave }: { job: GraphJob; links: GraphLink[]; have: Set<string>; onSkill: (slug: string) => void; isSaved: boolean; onSave: () => void }) {
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
      <div className="flex gap-2">
        <a href={job.url} target="_blank" rel="noreferrer" className={buttonVariants({ className: "flex-1" })}>Open the job post<ArrowUpRightIcon /></a>
        <Button variant="secondary" onClick={onSave} aria-pressed={isSaved} className="active:scale-[0.98]">
          {isSaved ? <BookmarkCheckIcon /> : <BookmarkIcon />}{isSaved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function SkillInfo({ skill, leader, jobs, onJob, status, onStart, onFinish }: { skill: Skill; leader?: Leader; jobs: GraphJob[]; onJob: (id: string) => void; status: "have" | "learning" | "none"; onStart: () => void; onFinish: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{skill.name}</h2>
        <p className="text-sm text-muted-foreground">{CATEGORIES.find((c) => c.slug === skill.category)?.name ?? "Skill"}{leader && ` · in ${leader.jobs} job posts near you`}</p>
        <p className="mt-1 text-sm">{status === "have" ? "On your resume" : status === "learning" ? "You're learning it" : "Not on your resume yet"}</p>
      </div>
      {status === "none" && <Button onClick={onStart} className="w-full active:scale-[0.98]">Start learning</Button>}
      {status === "learning" && <Button onClick={onFinish} className="w-full active:scale-[0.98]">Finish with a project</Button>}
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
