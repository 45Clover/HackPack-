import type { Metadata } from "next";
import { EarlyAccess } from "@/components/waitlist/early-access";

export const metadata: Metadata = { title: "Join the waitlist | Skilltrii" };

// The QR code at judging lands here (the landing page has the same form).
export default function Waitlist() {
  return <EarlyAccess source="waitlist" />;
}
