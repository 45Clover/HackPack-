// Owner: AI (@tomi-alo). POST /api/extras: run ONCE by hand after the extraction catch-up.
// One Gemini call writes project ideas for the top 15 skills into skill_extras.
import { generateProjectIdeas } from "@/lib/extras";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET; // same secret as /api/extract: protects the Gemini quota
  if (!secret || request.headers.get("x-ingest-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    return Response.json({ skills: await generateProjectIdeas() });
  } catch (err) {
    console.error("extras: Gemini failed", err);
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
