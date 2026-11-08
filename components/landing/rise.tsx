"use client";
// Scroll reveal: each [data-reveal] block rises in and comes into focus (a light blur clears) as it scrolls into view,
// a beat after its neighbours, and any [data-bar] inside it fills from the left. Reduced motion: everything is there.
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function Rise({ children, className }: { children: React.ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const blocks = gsap.utils.toArray<HTMLElement>("[data-reveal]", root.current);
    gsap.set(blocks, { opacity: 0, y: 32, filter: "blur(6px)" });
    ScrollTrigger.batch(blocks, {
      start: "top 88%",
      once: true,
      onEnter: (els) => {
        gsap.to(els, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, stagger: 0.08, ease: "power3.out", clearProps: "transform,filter" });
        const bars = els.flatMap((el) => [...el.querySelectorAll("[data-bar]")]);
        if (bars.length) gsap.from(bars, { scaleX: 0, duration: 0.8, stagger: 0.05, delay: 0.15, ease: "power3.out", transformOrigin: "left center" });
      },
    });
  }, { scope: root });
  return <div ref={root} className={className}>{children}</div>;
}
