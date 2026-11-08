"use client";
import Link from "next/link";
import { BellIcon, MenuIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ago } from "@/lib/ago";
import { openEditProfile } from "@/components/profile/edit-profile";

const icon = buttonVariants({ variant: "ghost", size: "icon" });
const go = (href: string) => window.location.assign(href); // full load: Auth0 routes and fresh server data

export function NavMenu({ signedIn }: { signedIn: boolean }) {
  return (
    <Sheet>
      <SheetTrigger className={icon} aria-label="Open menu"><MenuIcon /></SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader><SheetTitle>Skilltrii</SheetTitle></SheetHeader>
        <nav className="flex flex-col gap-1 px-4 text-sm">
          <Link className="rounded-md px-2 py-1.5 hover:bg-muted" href="/">{signedIn ? "My dashboard" : "Home"}</Link>
          <Link className="rounded-md px-2 py-1.5 hover:bg-muted" href="/explore">Browse mapped jobs</Link>
          {signedIn && <SheetClose className="rounded-md px-2 py-1.5 text-left hover:bg-muted" onClick={openEditProfile}>Edit my profile</SheetClose>}
          <Link className="rounded-md px-2 py-1.5 hover:bg-muted" href="/about">How it works &amp; privacy</Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

type Note = { title: string; url: string; company: string; posted_at: Date; internship: boolean };

export function NotificationsMenu({ items }: { items: Note[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${icon} relative`} aria-label={`Notifications: ${items.length} new matching jobs`}>
        <BellIcon />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {items.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup><DropdownMenuLabel>New jobs that match your skills</DropdownMenuLabel></DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nothing new this week.</p>}
        {items.map((n) => (
          <DropdownMenuItem key={n.url} onClick={() => window.open(n.url, "_blank", "noopener")} className="flex-col items-start gap-0">
            <span className="font-medium">{n.title}</span>
            <span className="text-xs text-muted-foreground">{n.internship && "Internship · "}{n.company} · {ago(n.posted_at)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu({ name, picture }: { name: string; picture: string | null }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  async function deleteMyData() {
    if (!confirm("Delete your skills and profile from Skilltrii? This can't be undone.")) return;
    await fetch("/api/onboarding", { method: "DELETE" });
    go("/auth/logout");
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={icon} aria-label="Your profile">
        <Avatar className="size-7">
          {picture && <AvatarImage src={picture} alt="" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup><DropdownMenuLabel>{name}</DropdownMenuLabel></DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openEditProfile}>Edit skills &amp; resume</DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("/about")}>Privacy</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={deleteMyData}>Delete my data</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go("/auth/logout")}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
