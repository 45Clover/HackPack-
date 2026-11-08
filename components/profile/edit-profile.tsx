"use client";
// Edit your profile without leaving the page: change your skills, role and city by hand, or upload a newer resume
// (the skills it finds are added to yours, to check before saving). One dialog for the whole app, in the site header;
// anything opens it with openEditProfile(). /onboarding stays the first-time flow.
import { useEffect, useMemo, useRef, useState } from "react";
import { FileUpIcon, XIcon } from "lucide-react";
import type { AnswersForm, Skill } from "@/lib/guest";
import { categoryColor } from "@/lib/categories";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EVENT = "hackpack:edit-profile";
export const openEditProfile = () => window.dispatchEvent(new Event(EVENT));

const ROLE_ITEMS = ROLES.map((r) => ({ value: r.slug, label: r.name }));

export function EditProfileDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AnswersForm | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load fresh on every open: your answers may have changed in another tab.
    const onOpen = () => {
      setOpen(true);
      setForm(null);
      setError("");
      fetch("/api/onboarding")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setForm, () => setError("Couldn't load your profile. Close this and try again."));
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-5 rounded-[1.75rem] p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit your profile</DialogTitle>
          <DialogDescription>Your map updates as soon as you save.</DialogDescription>
        </DialogHeader>
        {form ? (
          <ProfileForm form={form} />
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : (
          <div role="status" aria-label="Loading your profile" className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileForm({ form: { skills, cities, initial } }: { form: AnswersForm }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("hand");
  const [picked, setPicked] = useState(() => new Set(initial.skillIds));
  const [role, setRole] = useState(initial.role);
  const [city, setCity] = useState(initial.city);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState({ busy: false, message: "" });

  const known = useMemo(() => new Set(skills.map((s) => s.id)), [skills]);
  const mine = skills.filter((s) => picked.has(s.id)); // most asked for first, like everywhere else
  const q = query.trim().toLowerCase();
  const matches = q ? skills.filter((s) => !picked.has(s.id) && s.name.toLowerCase().includes(q)).slice(0, 8) : [];
  const toggle = (id: number) => setPicked((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });
  const add = (s: Skill) => { toggle(s.id); setQuery(""); };

  async function uploadResume(file: File) {
    setStatus({ busy: true, message: "Reading your resume…" });
    const body = new FormData();
    body.append("resume", file);
    const res = await fetch("/api/resume", { method: "POST", body }).catch(() => null);
    if (!res?.ok) return setStatus({ busy: false, message: res ? await res.text() : "Couldn't upload. Check your connection." });
    // Only skills some job post asks for: the rest can't move your map.
    const found = ((await res.json()) as { skills: Skill[] }).skills.filter((s) => known.has(s.id));
    const added = found.filter((s) => !picked.has(s.id)).length;
    setPicked((prev) => new Set([...prev, ...found.map((s) => s.id)]));
    setTab("hand");
    setStatus({ busy: false, message: `Found ${found.length} skills on your resume, ${added} new. Check them, then save. Your file wasn't saved.` });
  }

  async function save() {
    setStatus({ busy: true, message: "" });
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillIds: [...picked], targetRole: role, city }),
    }).catch(() => null);
    if (!res?.ok) return setStatus({ busy: false, message: "Couldn't save. Please try again." });
    window.location.reload(); // the map keeps your skills in its own state, so it reloads to draw the new ones
  }

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="w-full">
          <TabsTrigger value="hand">Edit by hand</TabsTrigger>
          <TabsTrigger value="resume">Upload a resume</TabsTrigger>
        </TabsList>

        <TabsContent value="hand" className="space-y-5 pt-3">
          <div className="space-y-2.5">
            <p className="text-sm font-medium">Your skills <span className="font-normal text-muted-foreground tabular-nums">{mine.length}</span></p>
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {mine.map((s) => (
                <Badge key={s.id} variant="outline" className="h-7 gap-1.5 pr-1.5">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
                  {s.name}
                  <button type="button" onClick={() => toggle(s.id)} aria-label={`Remove ${s.name}`} className="text-muted-foreground hover:text-foreground">
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
              {mine.length === 0 && <p className="text-sm text-muted-foreground">None yet. Add some below, or upload a resume.</p>}
            </div>
            <Input
              placeholder="Add a skill, e.g. Rust"
              aria-label="Add a skill"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); add(matches[0]); } }}
            />
            {q && (
              <div className="flex flex-wrap gap-1.5">
                {matches.map((s) => <Button key={s.id} type="button" size="sm" variant="secondary" onClick={() => add(s)}>+ {s.name}</Button>)}
                {matches.length === 0 && <p className="text-sm text-muted-foreground">No job posts ask for &ldquo;{query.trim()}&rdquo; yet.</p>}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Aiming for</p>
              <Select items={ROLE_ITEMS} value={role} onValueChange={(v) => v && setRole(String(v))}>
                <SelectTrigger aria-label="Target role" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_ITEMS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">City</p>
              <Select value={city} onValueChange={(c) => c && setCity(String(c))}>
                <SelectTrigger aria-label="Your city" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...new Set([city, ...cities])].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resume" className="pt-3">
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadResume(f); }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={status.busy}
            onClick={() => fileInput.current?.click()}
            className="h-auto w-full flex-col gap-2 rounded-2xl border-dashed p-8 whitespace-normal"
          >
            <FileUpIcon className="size-5 text-muted-foreground" />
            <span className="font-medium">Choose your updated resume (PDF)</span>
            <span className="text-sm font-normal text-muted-foreground">
              Up to 5 MB. The skills it finds are added to yours, to check before you save. The file is never saved and no AI reads it.
            </span>
          </Button>
        </TabsContent>
      </Tabs>

      {status.message && <p role="status" className="text-sm text-muted-foreground">{status.message}</p>}

      <DialogFooter className="-mx-6 -mb-6 rounded-b-[1.75rem] px-6">
        <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
        <Button onClick={save} disabled={status.busy}>{status.busy && !status.message ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </>
  );
}
