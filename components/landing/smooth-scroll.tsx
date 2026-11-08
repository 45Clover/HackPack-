"use client";
// Lenis smooth scrolling for the landing page, on GSAP's clock so ScrollTrigger reveals stay in step with it.
// Only mounted on the landing; the dashboard is a fixed screen and keeps normal scrolling. Lenis itself turns
// smoothing off for people who prefer reduced motion.
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09 });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33); // GSAP's default, for the pages after this one
      lenis.destroy();
    };
  }, []);
  return null;
}
