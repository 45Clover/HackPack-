// DEV-ONLY preview of the signed-out landing page (the parent routes "/" to it for signed-out visitors).
// shortcut: throwaway preview for design work; delete once "/" shows the landing page.
import { notFound } from "next/navigation";
import { Landing } from "@/components/landing/landing";

export default async function LandingPreview({ searchParams }: PageProps<"/preview/landing">) {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Landing searchParams={await searchParams} />;
}
