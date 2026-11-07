import Link from "next/link";
import { auth0 } from "@/lib/auth0";

export async function SiteHeader() {
  const session = await auth0.getSession();
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold">HackPack</Link>
        <Link href="/me">My skills</Link>
        <Link href="/about">About</Link>
        {/* Plain <a>: Auth0 routes need a full page load, not client navigation. */}
        <span className="ml-auto">
          {session ? <a href="/auth/logout">Sign out</a> : <a href="/auth/login">Sign in</a>}
        </span>
      </nav>
    </header>
  );
}
