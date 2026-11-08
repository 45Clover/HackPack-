"use client";
// The signed-in dashboard: the 3D constellation fills the screen (content layer),
// and three pieces of Liquid Glass float above it (functional layer): left panel, right panel, and the card on the selected node.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import {
  ArrowLeftIcon, ArrowUpRightIcon, BookmarkIcon, BookmarkCheckIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, SlidersHorizontalIcon,
  LayersIcon, TargetIcon, TrendingDownIcon, TrendingUpIcon, XIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CATEGORIES, categoryColor } from "@/lib/categories";
import { ago } from "@/lib/ago";
import type { GraphJob, GraphLink, Leader, MySkill, SavedJob } from "@/lib/dashboard";
import type { Scope } from "@/lib/scope";
import type { GLink, GNode } from "./graph-3d";
import { GraphBoundary } from "./graph-boundary";
import { SkillTree } from "./skill-tree";
import { MatchView } from "./match-view";
import { CompanyLogo, SkillIcon } from "./icons";
import { orbitLayout } from "./orbit";
import { ZoomControl } from "./zoom-control";
import { CategoryBar } from "./category-bar";
import { ROLES, roleBySlug } from "@/lib/roles";
import { openEditProfile } from "@/components/profile/edit-profile";

const Graph3D = dynamic(() => import("./graph-3d"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 grid place-items-center text-sm text-muted-foreground">Mapping your constellation…</div>,
});
const TreeBackdrop = dynamic(() => import("./backdrop"), { ssr: false });
gsap.registerPlugin(useGSAP);
const calm = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

type Skill = { id: number; slug: string; name: string; category: string | null };
type View = "map" | "match" | "tree";

const onResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
type Props = {
  user: { name: string; picture: string | null };
  role: string;
  roleSlug?: string; // the role the jobs are ranked for (saved, or ?role= from the filter menu)
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
  initialView?: View;
  layout?: "force"; // the 3D map is a donut (orbit) by default; ?layout=force brings back the free-floating layout
  myRole?: string | null; // the role they picked in onboarding: the left panel's button narrows the map to it
  guest?: boolean; // a guest's own map (from the onboarding cookie): show "Save your map"
};

export function DashboardShell({ user, role, scope, cities, mine, jobs, links, leaders, saved: initialSaved, started, persist, roleSlug, initialFocus, initialSidebarOpen = true, initialView = "map", layout, guest, myRole }: Props) {
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
  const [view, setView] = useState<View>(initialView);
  const hasMyRole = !!myRole && myRole !== "any";
  // Zoom slider per view, 0–100. The 3D map reports its own (null until its first camera move); 40 = 100% in the 2D views.
  const [zoom, setZoom] = useState<Record<View, number | null>>({ map: null, match: 40, tree: 40 });
  // Ignore tiny moves, so a camera that settles doesn't re-render the whole dashboard over and over.
  const setMapZoom = useCallback((v: number) => setZoom((z) => (z.map !== null && Math.abs(z.map - v) < 0.5 ? z : { ...z, map: v })), []);
  const scale = (v: number | null) => 0.6 + (v ?? 40) / 100; // 0.6×–1.6×
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  // The 3D map: jobs and the skills they ask for. Your skills show as filled spheres; missing ones as rings.
  const data = useMemo(() => {
    const nodes = new Map<string, GNode>();
    const edges: GLink[] = [];
    for (const j of jobs) nodes.set(`j:${j.id}`, { id: `j:${j.id}`, kind: "job", label: `${j.title} · ${j.company}`, jobId: j.id, title: j.title });
    for (const l of links) {
      if (!nodes.has(`s:${l.slug}`)) nodes.set(`s:${l.slug}`, { id: `s:${l.slug}`, kind: "skill", label: l.name, slug: l.slug, category: l.category });
      edges.push({ source: `j:${l.job_id}`, target: `s:${l.slug}`, kind: l.has ? "has" : "missing" });
    }
    if (layout !== "force") orbitLayout([...nodes.values()], edges);
    return { nodes: [...nodes.values()], links: edges };
  }, [jobs, links, layout]);

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
  // Area + job filters live in the URL. A transition keeps the map up while the new data loads.
  const [filtering, startFiltering] = useTransition();
  const setFilters = (next: Partial<Scope> & { role?: string }) => {
    const f = { ...scope, ...next };
    const q = new URLSearchParams({ scope: f.kind, city: f.city });
    if (f.remote) q.set("remote", "1");
    if (f.week) q.set("week", "1");
    const r = next.role ?? roleSlug;
    if (r) q.set("role", r);
    startFiltering(() => router.push(`?${q}`, { scroll: false }));
  };
  // Hovering a row lights up its node; keyboard focus does the same.
  const rowHover = (id: string) => ({
    onMouseEnter: () => setHoverId(id),
    onMouseLeave: () => setHoverId(null),
    onFocus: () => setHoverId(id),
    onBlur: () => setHoverId(null),
  });
  const startedList = [...learning];
  const learningNow = currentSlug && learning.has(currentSlug) ? currentSlug : startedList[startedList.length - 1] ?? null;
  async function finishLearning(slug: string) {
    await setSkillStatus(slug, "have");
    setCurrentSlug(null);
  }
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => setSelected(data.nodes.find((n) => n.id === focusId) ?? null), 2500); // after the layout settles
    return () => clearTimeout(t);
  }, [focusId, data]);
  const selectedJob = selected?.kind === "job" ? jobs.find((j) => j.id === selected.jobId) ?? null : null;
  const selectedSkill = selected?.kind === "skill" && selected.slug ? skills.get(selected.slug) ?? null : null;
  const visibleLeaders = leaders.filter((l) => !hidden.has(l.category ?? "")).slice(0, 10);
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();


  // ---- Motion (GSAP). Calm: 0.6–0.9s ease-out, no bounce. Reduced motion skips all of it. ----
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null); // the 3D map / tree backdrop
  const treeBox = useRef<HTMLDivElement>(null);

  // Entrance: panels slide in from the edges they're docked to. `.enter` starts them hidden (with a CSS fallback reveal);
  // once they're in, the class comes off so later GSAP fades (like the category bar's) aren't overridden by it.
  useGSAP(() => {
    const done = () => gsap.utils.toArray<HTMLElement>("[data-enter]").forEach((el) => { el.style.opacity = "1"; el.classList.remove("enter"); });
    if (!calm()) return done();
    gsap.timeline({ defaults: { duration: 0.8, ease: "power3.out" }, onComplete: done })
      .fromTo('[data-enter="top"]', { opacity: 0, y: -12 }, { opacity: 1, y: 0 }, 0.15)
      .fromTo('[data-enter="left"]', { opacity: 0, x: -40 }, { opacity: 1, x: 0 }, 0.25)
      .fromTo('[data-enter="right"]', { opacity: 0, x: 40 }, { opacity: 1, x: 0 }, 0.35)
      .fromTo('[data-enter="bottom"]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.08 }, 0.5);
  }, { scope: root });

  // New data (area, job filters, category, tab): rows ease in and bars fill.
  const listKey = `${scope.kind}|${scope.city}|${scope.remote}|${scope.week}|${[...hidden].join()}|${tab}|${!!selected}`;
  useGSAP(() => {
    if (!calm()) return;
    gsap.fromTo("[data-row]", { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: 0.6, stagger: 0.035, ease: "power3.out" });
    gsap.fromTo("[data-bar]", { scaleX: 0 }, { scaleX: 1, duration: 0.9, stagger: 0.035, ease: "power3.out", transformOrigin: "left center" });
  }, { scope: root, dependencies: [listKey] });

  // The category bar slides away in the Match view (it doesn't filter there) and comes back after.
  const categoryBar = useRef<HTMLElement>(null);
  const barSeen = useRef(false);
  useGSAP(() => {
    const hide = view === "match";
    if (!barSeen.current && !hide) return void (barSeen.current = true); // first load: the entrance handles it
    barSeen.current = true;
    gsap.to(categoryBar.current, { autoAlpha: hide ? 0 : 1, y: hide ? 16 : 0, duration: calm() ? 0.45 : 0, ease: "power3.out", overwrite: "auto" });
  }, { dependencies: [view] });

  // Map ↔ tree: fade the current view out, swap, fade the new one in (the tree then grows itself).
  const switchView = (next: View) => {
    if (next === view) return;
    if (!calm()) return setView(next);
    gsap.to([layer.current, treeBox.current].filter(Boolean), { opacity: 0, duration: 0.35, ease: "power2.in", onComplete: () => setView(next) });
  };
  useGSAP(() => {
    if (calm()) gsap.fromTo(layer.current, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power2.out" });
    else gsap.set(layer.current, { opacity: 1 });
  }, { dependencies: [view] });

  // Lenis smooths the tree's sideways scroll; a normal mouse wheel pans it sideways too. Runs on GSAP's clock.
  useEffect(() => {
    const wrapper = treeBox.current;
    if (view !== "tree" || !wrapper?.firstElementChild) return;
    const lenis = new Lenis({ wrapper, content: wrapper.firstElementChild, orientation: "horizontal", gestureOrientation: "both" });
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [view]);

  // The black card flips in when what it shows changes (you start a skill, or finish one). Not on first load.
  const cardSeen = useRef(false);
  const flipIn = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    if (!cardSeen.current) return void (cardSeen.current = true);
    if (calm()) gsap.fromTo(el, { opacity: 0, rotateX: -14, y: 12, transformPerspective: 700, transformOrigin: "50% 100%" }, { opacity: 1, rotateX: 0, y: 0, duration: 0.7, ease: "power3.out" });
  }, []);

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
    <div ref={root} className="contents">
      <div className="scene-bg fixed inset-0 z-0" aria-hidden="true">
        <div ref={layer} className="absolute inset-0">
          {view === "map" && (
          <GraphBoundary>
            <Graph3D zoom={zoom.map} onZoom={setMapZoom} orbit={layout !== "force"} data={data} have={have} learning={learning} hidden={hidden} selectedId={selected?.id ?? null} onSelect={setSelected} hoverId={hoverId} mini={mini} width={width} height={height} />
          </GraphBoundary>
          )}
          {view === "tree" && <TreeBackdrop />}
        </div>
      </div>

      {/* 2D view: jobs ↔ skills (Saagii's canvas), in the space between the panels. */}
      {view === "match" && (
        <div ref={treeBox} className="relative z-[5] overflow-auto lg:fixed lg:top-[132px] lg:right-[calc(clamp(270px,19.8vw,350px)+16px)] lg:bottom-[78px] lg:left-[calc(clamp(250px,18.6vw,330px)+16px)]">
          <MatchView
            jobs={jobs}
            links={links}
            have={have}
            learning={learning}
            matchOf={matchOf}
            focusId={hoverId ?? selected?.id ?? null}
            onHover={setHoverId}
            onSelect={select}
            scale={scale(zoom.match)}
          />
        </div>
      )}

      {/* 2D view: the skill tree, in the space between the panels. */}
      {view === "tree" && (
        <div ref={treeBox} className="relative z-[5] flex flex-col-reverse overflow-auto lg:fixed lg:top-[132px] lg:right-[calc(clamp(270px,19.8vw,350px)+16px)] lg:bottom-[78px] lg:left-[calc(clamp(250px,18.6vw,330px)+16px)]">
          <SkillTree
            skills={[...skills.values()]}
            have={have}
            learning={learning}
            hidden={hidden}
            jobCount={jobCount}
            nextSlug={nextSkill?.skill.slug ?? null}
            selectedSlug={selectedSkill?.slug ?? null}
            onSelect={(slug) => select(`s:${slug}`)}
            scale={scale(zoom.tree)}
          />
        </div>
      )}

      {/* Mobile: the panels stack over the graph. Desktop: they slide out from the screen edges (Saagii's mockup). */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-4 lg:contents">
        {/* LEFT: the student card (collapsible) and the black Learning card (always there). No cards inside cards. */}
        <div data-enter="left" className="enter flex flex-col gap-4 lg:fixed lg:top-[122px] lg:bottom-0 lg:left-0 lg:w-[clamp(250px,18.6vw,330px)] lg:gap-[30px]">
        <div className={`relative min-h-0 flex-1 lg:transition-transform lg:duration-500 lg:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${leftOpen ? "" : "lg:-translate-x-full"}`}>
        <section id="student-card" inert={!leftOpen} className="surface pointer-events-auto flex h-full flex-col gap-6 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:rounded-l-none lg:rounded-r-[40px]">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {user.picture && <AvatarImage src={user.picture} alt="" />}
              <AvatarFallback className="bg-secondary text-sm font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-2xl leading-tight font-medium tracking-tight break-words">{user.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{hasMyRole ? roleBySlug(myRole).name : role} · {scope.kind === "canada" ? "Canada" : scope.city}</p>
            </div>
          </div>
          {/* The map shows every role by default; this narrows it to the role they picked (and back). */}
          {hasMyRole && (
            <Button
              variant="secondary"
              size="sm"
              aria-pressed={roleSlug === myRole}
              disabled={filtering}
              onClick={() => setFilters({ role: roleSlug === myRole ? "any" : myRole! })}
              className="-mt-2 self-start rounded-full active:scale-[0.97]"
            >
              {roleSlug === myRole ? <><LayersIcon />Show all roles</> : <><TargetIcon />Show {roleBySlug(myRole).name} jobs</>}
            </Button>
          )}

          <dl className="flex justify-between border-y border-border py-4">
            {([["Skills", have.size], ["Saved", saved.length], ["Started", learning.size]] as const).map(([label, n]) => (
              <div key={label}>
                <dd className="text-[28px] leading-none font-medium tracking-tight tabular-nums"><Count value={n} /></dd>
                <dt className="eyebrow mt-1.5">{label}</dt>
              </div>
            ))}
          </dl>

          {guest && (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">Save your map.</span>{" "}
                <span className="text-muted-foreground">Sign in with Google to keep your skills and track what you learn.</span>
              </p>
              <Link
                href="/login?returnTo=/api/onboarding/claim"
                className={buttonVariants({ className: "w-full" })}
              >
                Save your map
              </Link>
            </div>
          )}

          <PanelList title="Saved" count={saved.length} empty="Save jobs from the graph to keep them here.">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5">
                <CompanyLogo name={s.company} />
                <button className="min-w-0 flex-1 text-left" onClick={() => (data.nodes.some((n) => n.id === `j:${s.id}`) ? select(`j:${s.id}`) : window.open(s.url, "_blank", "noopener"))}>
                  <span className="block truncate text-sm">{s.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.company}</span>
                </button>
                <button aria-label={`Unsave ${s.title}`} className="text-[var(--blue)] hover:opacity-70" onClick={() => {
                  const job = jobs.find((j) => j.id === s.id);
                  if (job) toggleSaved(job);
                  else setSaved(saved.filter((x) => x.id !== s.id));
                }}><BookmarkCheckIcon className="size-4" /></button>
              </li>
            ))}
          </PanelList>

          <PanelList title="Started" count={learning.size} empty="Start a skill from its card. It stays here until you've learned it.">
            {startedList.map((slug) => skills.get(slug)).filter((s): s is Skill => !!s).map((s) => (
              <li key={s.slug} className="flex items-center gap-2.5">
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                  aria-current={s.slug === learningNow}
                  onClick={() => { setCurrentSlug(s.slug); select(`s:${s.slug}`); }}
                >
                  <span className="shrink-0" style={{ color: categoryColor(s.category) }}><SkillIcon slug={s.slug} category={s.category} /></span>
                  <span className={`truncate ${s.slug === learningNow ? "font-medium" : ""}`}>{s.name}</span>
                </button>
                <button aria-label={`Stop learning ${s.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setSkillStatus(s.slug, "none")}><XIcon className="size-3.5" /></button>
              </li>
            ))}
          </PanelList>

          <button onClick={openEditProfile} className="mt-auto text-left text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Edit skills &amp; resume</button>
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
        {/* The black card: what you're learning now (with its guide), else the next skill to start. */}
        {learningNow && skills.get(learningNow) ? (
          <section key={`learning:${learningNow}`} ref={flipIn} className="surface-ink noise relative isolate pointer-events-auto shrink-0 space-y-3 overflow-hidden p-6 lg:rounded-none lg:rounded-tr-[40px]">
            <CardGlow skill={skills.get(learningNow)!} />
            <CardEyebrow label="Learning now" skill={skills.get(learningNow)!} />
            <p className="text-[40px] leading-[1.05] font-medium tracking-tight break-words">{skills.get(learningNow)!.name}</p>
            <p className="text-sm text-white/60">Follow the guide, then mark it learned.</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/skills/${learningNow}`}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition-transform active:scale-[0.98]"
              >
                Learning guide
              </Link>
              <button className="rounded-full px-3 py-2 text-sm text-white/70 hover:text-white" onClick={() => finishLearning(learningNow)}>I&apos;ve learned it</button>
            </div>
          </section>
        ) : nextSkill ? (
          <section key={`next:${nextSkill.skill.slug}`} ref={flipIn} className="surface-ink noise relative isolate pointer-events-auto shrink-0 space-y-3 overflow-hidden p-6 lg:rounded-none lg:rounded-tr-[40px]">
            <CardGlow skill={nextSkill.skill} />
            <CardEyebrow label="Next skill" skill={nextSkill.skill} />
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
          <div data-enter="top" className="enter pointer-events-none hidden text-center lg:fixed lg:inset-x-0 lg:top-[68px] lg:block">
            <h1 className="text-2xl font-medium tracking-tight">Your skill map</h1>
            <p className={`mt-1 text-sm text-muted-foreground transition-opacity duration-300 ${filtering ? "opacity-40" : ""}`}>
              {scope.kind === "canada" ? "Canada" : scope.city} · {jobs.length} closest jobs · {have.size} skills
            </p>
          </div>
          <ZoomControl value={zoom[view] ?? 50} onChange={(v) => setZoom((z) => ({ ...z, [view]: v }))} />
          {/* 3D map / Match / Skill tree switch, bottom-right corner of the screen */}
          <div data-enter="bottom" className="enter surface pointer-events-auto fixed right-5 bottom-5 z-20 hidden rounded-full p-1 lg:inline-flex" role="group" aria-label="View">
              {(["map", "match", "tree"] as const).map((v) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  onClick={() => switchView(v)}
                  className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${view === v ? "bg-[var(--ink)] text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "map" ? "3D map" : v === "match" ? "Match" : "Skill tree"}
                </button>
              ))}
            </div>
          <nav ref={categoryBar} inert={view === "match"} data-enter="bottom" aria-label="Focus one category" className="enter surface pointer-events-auto hidden max-w-[calc(100vw-clamp(250px,18.6vw,330px)-clamp(270px,19.8vw,350px)-48px)] items-center gap-0.5 rounded-full p-1.5 lg:fixed lg:bottom-5 lg:left-1/2 lg:flex lg:-translate-x-1/2">
            <CategoryBar
              cats={[{ slug: "all", label: "All" }, ...CATEGORIES.filter((c) => [...skills.values()].some((sk) => sk.category === c.slug)).map((c) => ({ slug: c.slug, label: c.short, color: c.color }))]}
              active={hidden.size === 0 ? "all" : hidden.size === CATEGORIES.length - 1 ? CATEGORIES.find((c) => !hidden.has(c.slug))?.slug ?? null : null}
              onPick={(slug) => setHidden(slug === "all" ? new Set() : new Set(CATEGORIES.filter((x) => x.slug !== slug).map((x) => x.slug)))}
            />
          </nav>
        </div>

        {/* RIGHT: leaderboard / closest jobs, or "overall info" for the selected node */}
        <aside data-enter="right" className="enter surface pointer-events-auto flex flex-col gap-5 overflow-y-auto p-6 lg:fixed lg:top-[122px] lg:right-0 lg:bottom-0 lg:w-[clamp(270px,19.8vw,350px)] lg:rounded-none lg:rounded-tl-[40px] lg:pb-24">
          <div className="flex items-center justify-between gap-2">
            {selected ? (
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>
                <ArrowLeftIcon className="size-4" />Overall info
              </button>
            ) : (
              <div>
                <h2 className="text-xl font-medium tracking-tight">Leaderboard</h2>
                <p className="text-sm text-muted-foreground">
                  {[scope.kind === "canada" ? "All of Canada" : scope.city, scope.remote && "Remote", scope.week && "This week"].filter(Boolean).join(" · ")}
                </p>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Filter: area, role and jobs">
                <SlidersHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {/* Base UI menus need every label inside a group, or the menu throws when it opens. */}
                <DropdownMenuRadioGroup value={scope.kind} onValueChange={(v) => setFilters({ kind: v === "canada" ? "canada" : "city" })}>
                  <DropdownMenuLabel>Area</DropdownMenuLabel>
                  <DropdownMenuRadioItem value="city">{scope.city}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="canada">All of Canada</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {cities.length > 1 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Change city</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      <DropdownMenuRadioGroup value={scope.city} onValueChange={(c) => setFilters({ kind: "city", city: String(c) })}>
                        {cities.map((c) => <DropdownMenuRadioItem key={c} value={c}>{c}</DropdownMenuRadioItem>)}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Role</DropdownMenuLabel>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>{roleBySlug(roleSlug).name}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                      <DropdownMenuRadioGroup value={roleSlug ?? "any"} onValueChange={(r) => setFilters({ role: String(r) })}>
                        {ROLES.map((r) => <DropdownMenuRadioItem key={r.slug} value={r.slug}>{r.name}</DropdownMenuRadioItem>)}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Jobs</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem closeOnClick={false} checked={scope.remote} onCheckedChange={(on) => setFilters({ remote: !!on })}>Remote only</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem closeOnClick={false} checked={scope.week} onCheckedChange={(on) => setFilters({ week: !!on })}>Posted this week</DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
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
              onFinish={() => finishLearning(selectedSkill.slug)}
            />
          ) : (
            <>
              <ToggleGroup aria-label="List" value={[tab]} onValueChange={(v) => v[0] && setTab(v[0] as "skills" | "jobs")} className="w-full">
                <ToggleGroupItem value="skills" className="flex-1">Top skills</ToggleGroupItem>
                <ToggleGroupItem value="jobs" className="flex-1">Closest jobs</ToggleGroupItem>
              </ToggleGroup>
              {tab === "skills" ? (
                <ol className={`space-y-3 transition-opacity duration-300 ${filtering ? "opacity-40" : ""}`} aria-busy={filtering}>
                  {visibleLeaders.map((l, i) => (
                    <li key={l.slug} data-row>
                      <button
                        className="flex w-full items-center gap-2.5 rounded-lg text-left text-sm"
                        {...rowHover(`s:${l.slug}`)}
                        onClick={() => { setHoverId(null); if (data.nodes.some((n) => n.id === `s:${l.slug}`)) select(`s:${l.slug}`); else router.push(`/skills/${l.slug}`); }}
                      >
                        <span className="w-4 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                        <span className="shrink-0 text-foreground/75"><SkillIcon slug={l.slug} category={l.category} /></span>
                        <span className="flex-1 truncate">{l.name}</span>
                        {have.has(l.slug) && <CheckIcon className="size-3.5 text-[var(--have)]" aria-label="You have this" />}
                        <Trend week={l.week} prev={l.prev} hidden={scope.week} />
                        <span className="font-mono text-xs text-muted-foreground"><Count value={l.jobs} /></span>
                      </button>
                      <div className="mt-1.5 ml-[3rem] h-[3px] rounded-full bg-secondary" aria-hidden>
                        <div data-bar className="h-full rounded-full" style={{ width: `${(l.jobs / (visibleLeaders[0]?.jobs || 1)) * 100}%`, background: categoryColor(l.category) }} />
                      </div>
                    </li>
                  ))}
                  {visibleLeaders.length === 0 && <p className="text-sm text-muted-foreground">No skills in the categories you picked.</p>}
                </ol>
              ) : (
                <ul className={`space-y-1 transition-opacity duration-300 ${filtering ? "opacity-40" : ""}`} aria-busy={filtering}>
                  {jobs.map((j) => {
                    const m = matchOf(j.id);
                    return (
                      <li key={j.id} data-row>
                        <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary" {...rowHover(`j:${j.id}`)} onClick={() => { setHoverId(null); select(`j:${j.id}`); }}>
                          <CompanyLogo name={j.company} />
                          <span className="min-w-0 flex-1">
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
    </div>
  );
}

// A number that counts to its new value. GSAP owns the text after the first render, so React never fights it.
function Count({ value }: { value: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const [first] = useState(value);
  const shown = useRef(0);
  useGSAP(() => {
    const o = { v: shown.current };
    const paint = () => { if (el.current) el.current.textContent = String(Math.round(o.v)); };
    shown.current = value;
    if (!calm()) return void ((o.v = value), paint());
    gsap.to(o, { v: value, duration: 0.9, ease: "power2.out", onUpdate: paint });
  }, { dependencies: [value] });
  return <span ref={el}>{first}</span>;
}

// The black card's top row: what it shows, and the skill's logo (or its category icon).
function CardEyebrow({ label, skill }: { label: string; skill: Skill }) {
  return (
    <div className="relative flex items-center justify-between">
      <p className="text-sm text-white/60">{label}</p>
      <SkillIcon slug={skill.slug} category={skill.category} className="size-7 text-white/90" />
    </div>
  );
}

// A soft glow in the skill's category colour, tucked into the black card's bottom-right corner.
function CardGlow({ skill }: { skill: Skill }) {
  return <div aria-hidden className="pointer-events-none absolute -right-20 -bottom-24 -z-10 size-64 rounded-full opacity-45 blur-3xl" style={{ background: categoryColor(skill.category) }} />;
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

// ▲ / ▼: more or fewer posts asking for it this week than last week. Hidden under "Posted this week" (no last week to compare).
function Trend({ week, prev, hidden }: { week: number; prev: number; hidden: boolean }) {
  if (hidden || week === prev) return null;
  const up = week > prev;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <span className={`flex items-center gap-0.5 font-mono text-[11px] ${up ? "text-[var(--have)]" : "text-muted-foreground"}`} aria-label={`${week} posts this week, ${prev} last week`}>
      <Icon aria-hidden className="size-3" />{up ? "+" : "−"}{Math.abs(week - prev)}
    </span>
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
        <CompanyLogo name={job.company} className="mb-3 size-10" />
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
      {status === "learning" && <Button onClick={onFinish} className="w-full active:scale-[0.98]">I&apos;ve learned it</Button>}
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
