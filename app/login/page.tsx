import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, LockIcon } from "lucide-react";
import { siGoogle } from "simple-icons";
import { authReady } from "@/lib/auth0";
import { BrandPanel } from "@/components/brand-panel";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign in | Skilltri" };

// Same-site paths only: "//evil.com" and "/\evil.com" are other sites to a browser, control characters get stripped
// into one. Auth0 checks returnTo again on its side.
function safeReturnTo(value: string | string[] | undefined) {
  return typeof value === "string" && /^\/(?![/\\])[^\p{Cc}]*$/u.test(value) ? value : "/";
}

// Our own sign-in screen, which hands off to Auth0. People mostly land here from "Save your map" (returnTo = the
// claim route) or the header's Sign in.
export default async function Login({ searchParams }: PageProps<"/login">) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  const claiming = returnTo.startsWith("/api/onboarding/claim");
  // Plain <a>, not next/link: /auth/* needs a full page load. Every query param but returnTo goes on to /authorize.
  const google = `/auth/login?${new URLSearchParams({ connection: "google-oauth2", returnTo })}`;
  const email = `/auth/login?${new URLSearchParams({ returnTo })}`;
  const big = "h-11 w-full gap-2.5 text-[15px] active:scale-[0.97]";

  return (
    <main className="fixed inset-0 z-40 grid overflow-y-auto bg-background md:grid-cols-2">
      <BrandPanel
        title="Track what you learn."
        note="Your map keeps the skills you have and the ones you're learning, and shows the real jobs you're getting closer to."
      />

      <section className="flex min-h-dvh flex-col px-6 py-8 md:px-16 md:py-10">
        <div className="flex items-center">
          <span className="text-[15px] font-semibold tracking-tight md:hidden">Skilltri</span>
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm", className: "ml-auto text-muted-foreground md:-ml-2.5" })}>
            <ArrowLeftIcon /> Back
          </Link>
        </div>

        <div className="rise-in my-auto w-full max-w-md space-y-8 py-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{claiming ? "Save your skill map" : "Sign in to Skilltri"}</h1>
            <p className="text-muted-foreground">
              {claiming
                ? "Sign in and we keep the skills you just picked, so your map is here next time."
                : "Save your skills and see the real jobs you're closest to."}
            </p>
          </div>

          <div className="grid gap-3">
            <a href={google} className={buttonVariants({ size: "lg", className: big })}>
              <svg viewBox="0 0 24 24" aria-hidden fill="currentColor"><path d={siGoogle.path} /></svg>
              Continue with Google
            </a>
            <a href={email} className={buttonVariants({ variant: "outline", size: "lg", className: `${big} bg-card` })}>
              Continue with email
            </a>
          </div>

          {!authReady && (
            <p role="status" className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
              Sign-in isn&apos;t set up on this machine yet: the Auth0 keys are missing.
            </p>
          )}

          <p className="flex gap-2 text-sm text-muted-foreground">
            <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--blue)]" />
            <span>
              We keep your name, email and the skills you save. Never your resume.{" "}
              <Link href="/about" className="text-foreground underline underline-offset-4">Privacy</Link>
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}
