import { auth0 } from "@/lib/auth0";
import { sql } from "@/lib/db";
import { matchSkills, pdfToText } from "@/lib/resume";

const MAX_BYTES = 5 * 1024 * 1024;

// Upload a resume PDF → the known skills it mentions. The file is read in memory and never saved.
export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session) return new Response("Sign in first", { status: 401 });

  const file = (await req.formData()).get("resume");
  if (!(file instanceof File) || file.type !== "application/pdf") return new Response("Please upload a PDF", { status: 400 });
  if (file.size > MAX_BYTES) return new Response("The PDF must be under 5 MB", { status: 413 });

  let text: string;
  try {
    text = await pdfToText(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return new Response("We couldn't read that PDF", { status: 422 });
  }
  const known = await sql<{ id: number; slug: string; name: string; category: string | null }[]>`
    select id, slug, name, category from skills`;
  return Response.json({ skills: matchSkills(text, [...known]) });
}
