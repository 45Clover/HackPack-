// Owner: Job data. What n8n calls every morning (logdata/n8n-daily-ingest.json). One call, no body:
// lib/daily.ts decides which boards to fetch and whether Common Crawl or Keenable is due.
import { runDaily } from "@/lib/daily";

export const maxDuration = 60; // runDaily stops itself at 40 s; n8n waits 90 s

export async function POST(req: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret || req.headers.get("x-ingest-secret") !== secret) return new Response("Forbidden", { status: 403 });
  return Response.json(await runDaily());
}
