import type { Metadata } from "next";
import { EarlyAccess } from "@/components/waitlist/early-access";

export const metadata: Metadata = { title: "Join early | Skilltrii" };

// The same early-access screen as /waitlist, at its own link, so sign-ups from it are counted apart (source joinearly).
export default function JoinEarly() {
  return <EarlyAccess source="joinearly" />;
}
