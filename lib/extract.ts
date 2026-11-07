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
// Each model has its own daily quota. When the main one is used up, try the lighter one.
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const MIN_GAP_MS = 13_000; // free tier allows 5 requests per minute → at most one call every 12 s

const CATEGORY_SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));

let ai: GoogleGenAI | null = null; // created on first use, so importing this file never needs the key
let lastCallAt = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function extractSkillsBatch(jobs: JobInput[]): Promise<JobSkills[]> {
  if (jobs.length === 0) return [];
  if (jobs.length > MAX_BATCH) throw new Error(`extractSkillsBatch: max ${MAX_BATCH} jobs per call, got ${jobs.length}`);
  const text = await callGemini(buildExtractInput(jobs));
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

async function callGemini(input: string): Promise<string> {
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
          systemInstruction: EXTRACT_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: EXTRACT_SCHEMA,
          temperature: 0, // same input → same answer, as far as the model allows
        },
      });
      return res.text ?? '{"jobs":[]}';
    } catch (err) {
      // 429 = this model's quota is used up. Fall through to the next model.
      // Anything else (bad key, bad request) is a real error, so stop.
      if ((err as { status?: number }).status === 429) {
        console.warn(`Gemini 429 on ${model}, trying the next model.`);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Gemini quota used up on every model. It resets at 1 AM Calgary time.");
}
