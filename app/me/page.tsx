// Owner: UI (@SaagiiSG). Needs the real lib/auth0.ts + /api/me/skills from Platform + auth (@fabf28).
// Build from the tutorial, T6 step 6: my skills, "jobs you're closest to", and a "Delete my data" button.
export default function Me() {
  return (
    <main className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">My skills</h1>
      <p className="text-muted-foreground">Sign in to mark the skills you have and see the real jobs you&apos;re closest to.</p>
    </main>
  );
}
