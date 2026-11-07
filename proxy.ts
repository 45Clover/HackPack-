import { NextResponse, type NextRequest } from "next/server";
import { auth0, authReady } from "./lib/auth0";

// Auth0 mounts /auth/login, /auth/logout and /auth/callback here, and keeps the session cookie fresh.
export async function proxy(request: NextRequest) {
  if (!authReady) return NextResponse.next();
  return await auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
