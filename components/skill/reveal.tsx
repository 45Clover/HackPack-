"use client";
// Page entrance for the Learning guide: each [data-reveal] block rises in, a beat after the one before.
// Short and ease-out (Emil's rule: things appear from almost-there, never from nothing). Reduced motion: no movement.
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from("[data-reveal]", { opacity: 0, y: 10, duration: 0.45, stagger: 0.06, ease: "power3.out", clearProps: "transform" });
  }, { scope: root });
  return <div ref={root} className={className}>{children}</div>;
}
