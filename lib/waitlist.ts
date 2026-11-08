// Owner: UI (@SaagiiSG). Pre-registration (db/010): the waitlist form's body → a clean row, or null.
// No server imports, so the form uses the same role list.
export const WAITLIST_ROLES = [
  { value: "student", label: "Student" },
  { value: "career_switcher", label: "Career switcher" },
  { value: "educator", label: "Educator" },
  { value: "employer", label: "Employer" },
];

// Where they joined: the landing section, /waitlist (the QR code at judging) or /joinearly.
export const SOURCES = ["landing", "waitlist", "joinearly"] as const;
export type Source = (typeof SOURCES)[number];
export type WaitlistEntry = { email: string; role: string; internships: boolean; source: Source };

// something@something.tld with no spaces. The real check is the launch email arriving.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseWaitlist(body: unknown): WaitlistEntry | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return null;
  if (!WAITLIST_ROLES.some((r) => r.value === b.role)) return null;
  return { email, role: b.role as string, internships: b.internships === true, source: SOURCES.includes(b.source as Source) ? (b.source as Source) : "landing" };
}

// The hidden `company` field: people never see it, form-filling bots fill it in.
export const isBot = (body: unknown) => Boolean((body as { company?: unknown } | null)?.company);
