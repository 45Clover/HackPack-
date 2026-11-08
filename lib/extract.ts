// Owner: AI (@tomi-alo). Gemini's ONE job in this app: read job posts and list the
// technical skills each one asks for. Everything around it (saving, cleaning names,
// counting demand) is plain code we wrote.
//
// Free tier = 20 requests per day PER MODEL, so we send up to 20 jobs in ONE request.
// The prompt and JSON schema live in lib/extract-prompt.ts.
import { GoogleGenAI } from "@google/genai";
import { CATEGORIES } from "./categories";
import { EXTRACT_SCHEMA, EXTRACT_SYSTEM_PROMPT, SENIORITY, buildExtractInput, type ExtractResult } from "./extract-prompt";

export type JobInput = { id: string; title: string; description: string };
export type JobSkills = ExtractResult["jobs"][number];

export const MAX_BATCH = 20;

// Read ?batch=N from a request URL. Missing or invalid → the full batch (20).
export function batchSize(url: string): number {
  const n = Number(new URL(url).searchParams.get("batch"));
  return Number.isInteger(n) && n >= 1 && n <= MAX_BATCH ? n : MAX_BATCH;
}
// Each model has its own daily quota. When the main one is used up or overloaded, try the lighter one.
// Pinned names (not "-latest" aliases), so the model can't silently change under us mid-demo.
const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
const MIN_GAP_MS = 13_000; // free tier allows 5 requests per minute → at most one call every 12 s

const CATEGORY_SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));

let ai: GoogleGenAI | null = null; // created on first use, so importing this file never needs the key
let lastCallAt = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function extractSkillsBatch(jobs: JobInput[], opts: GeminiOptions = {}): Promise<JobSkills[]> {
  if (jobs.length === 0) return [];
  if (jobs.length > MAX_BATCH) throw new Error(`extractSkillsBatch: max ${MAX_BATCH} jobs per call, got ${jobs.length}`);
  const text = await callGemini(buildExtractInput(jobs), EXTRACT_SYSTEM_PROMPT, EXTRACT_SCHEMA, opts);
  return cleanResults(jobs, JSON.parse(text) as Partial<ExtractResult>);
}

// Never trust model output blindly. Keep a result only if its id is one we sent,
// keep each job once, and drop skills that would break the database
// (empty name, or a category the skill_categories table doesn't have).
// Exported so the test can check it without calling Gemini.
export function cleanResults(jobs: JobInput[], parsed: Partial<ExtractResult>): JobSkills[] {
  const sent = new Set(jobs.map((j) => j.id));
  const done = new Set<string>();
  const out: JobSkills[] = [];

  for (const r of parsed.jobs ?? []) {
    if (!sent.has(r.id) || done.has(r.id)) continue;
    done.add(r.id);

    const names = new Set<string>();
    const skills = (r.skills ?? []).filter((s) => {
      const key = s.name?.trim().toLowerCase();
      if (!key || names.has(key) || !CATEGORY_SLUGS.has(s.category)) return false;
      names.add(key);
      return true;
    }).map((s) => ({ name: s.name.trim(), category: s.category, required: s.required !== false }));

    const seniority = SENIORITY.includes(r.seniority) ? r.seniority : "unknown";
    out.push({ id: r.id, seniority, skills });
  }
  return out; // a job missing here was not extracted; /api/extract leaves extracted = false and retries it later
}

// timeoutMs = how long ONE model gets before we give up on it and try the next one.
// Unset = wait as long as it takes (fine on a laptop, where big batches can take minutes).
export type GeminiOptions = { timeoutMs?: number };

// Should we move on to the next model? Yes for: quota used up (429), overloaded (503),
// Google ran past our deadline (504 DEADLINE_EXCEEDED, seen live on Vercel), or our own
// time limit ran out. Anything else (bad key, bad request) is a real error.
export function shouldTryNextModel(err: unknown): boolean {
  const e = err as { status?: number; name?: string; message?: string };
  if (e.status === 429 || e.status === 503 || e.status === 504) return true;
  return e.name === "AbortError" || e.name === "TimeoutError" || /timed? ?out|abort|deadline/i.test(e.message ?? "");
}

// Shared by extract.ts and extras.ts: one throttled Gemini call that must return JSON
// matching `schema`, falling back to the next model on quota, overload or timeout.
export async function callGemini(input: string, systemInstruction: string, schema: unknown, opts: GeminiOptions = {}): Promise<string> {
  // v1beta: the "-latest" model aliases and responseJsonSchema only exist there, not on v1.
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: "v1beta" });

  for (const model of MODELS) {
    // Throttle: wait until at least MIN_GAP_MS has passed since the last call.
    const wait = lastCallAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();

    try {
      const res = await ai.models.generateContent({
        model,
        contents: input,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature: 0, // same input → same answer, as far as the model allows
          ...(opts.timeoutMs ? { httpOptions: { timeout: opts.timeoutMs } } : {}),
        },
      });
      return res.text ?? '{"jobs":[]}';
    } catch (err) {
      if (shouldTryNextModel(err)) {
        console.warn(`Gemini gave up on ${model} (${(err as { status?: number }).status ?? "timeout"}), trying the next model.`);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Every Gemini model is out of quota (resets 1 AM Calgary), overloaded, or too slow. Try again later.");
}
