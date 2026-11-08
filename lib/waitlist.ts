// Owner: UI (@SaagiiSG). Pre-registration (db/010): the waitlist form's body → a clean row, or null.
// No server imports, so the form uses the same role list.
export const WAITLIST_ROLES = [
  { value: "student", label: "Student" },
  { value: "career_switcher", label: "Career switcher" },
  { value: "educator", label: "Educator" },
  { value: "employer", label: "Employer" },
];

export type WaitlistEntry = { email: string; role: string; internships: boolean; source: "landing" | "waitlist" };

// something@something.tld with no spaces. The real check is the launch email arriving.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseWaitlist(body: unknown): WaitlistEntry | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return null;
  if (!WAITLIST_ROLES.some((r) => r.value === b.role)) return null;
  return { email, role: b.role as string, internships: b.internships === true, source: b.source === "waitlist" ? "waitlist" : "landing" };
}

// The hidden `company` field: people never see it, form-filling bots fill it in.
export const isBot = (body: unknown) => Boolean((body as { company?: unknown } | null)?.company);
