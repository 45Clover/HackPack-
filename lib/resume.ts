// Reads a resume PDF in memory and finds which of our known skills it mentions. No AI call, nothing stored.
import { extractText, getDocumentProxy } from "unpdf";

export async function pdfToText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole-word match. Names of 3 letters or fewer (Go, R, AWS, SQL) must match case exactly, so "go to" doesn't count.
export function matchSkills<T extends { name: string }>(text: string, skills: T[]): T[] {
  return skills.filter(({ name }) =>
    new RegExp(`(?<![A-Za-z0-9])${escape(name)}(?![A-Za-z0-9+#])`, name.length <= 3 ? "" : "i").test(text),
  );
}
