import Link from "next/link";
import { auth0, authReady } from "@/lib/auth0";
import { getNotifications, getProfile } from "@/lib/dashboard";
import { buttonVariants } from "@/components/ui/button";
import { NavMenu, NotificationsMenu, UserMenu } from "@/components/header-menus";
import { LiquidTopBar } from "@/components/liquid";

// Top bar: [menu] HackPack ............ [notifications] [profile]
export async function SiteHeader() {
  const session = authReady ? await auth0.getSession() : null;
  const notifications = session
    ? await getNotifications(session.user.sub, (await getProfile(session.user.sub))?.city ?? null)
    : [];

  return (
    <LiquidTopBar>
      <nav className="flex h-[62px] w-[calc(100vw-16px)] items-center gap-2 px-3 pt-[10px] text-sm text-foreground lg:w-[78vw]">
        <NavMenu signedIn={!!session} />
        <Link href="/" className="text-[15px] font-semibold tracking-tight">HackPack</Link>
        <div className="ml-auto flex items-center gap-1">
          {session ? (
            <>
              <NotificationsMenu items={notifications} />
              <UserMenu name={session.user.name ?? "You"} picture={session.user.picture ?? null} />
            </>
          ) : (
            // Plain <a>: Auth0 routes need a full page load, not client navigation.
            <a href="/auth/login?returnTo=/onboarding" className={buttonVariants({ size: "sm" })}>Sign in</a>
          )}
        </div>
      </nav>
    </LiquidTopBar>
  );
}
