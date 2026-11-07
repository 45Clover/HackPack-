"use client";
// Real Liquid Glass (github.com/rdev/liquid-glass-react: SVG displacement + chromatic aberration), used only on the two
// compact floating controls. Text-heavy panels keep the calmer regular glass, per Apple's Liquid Glass guidance.
// The library centres itself on top/left, so we pass the centre point.
import LiquidGlass from "liquid-glass-react";
import type { ReactNode } from "react";

// Hangs from the top edge: centred 10px above the visible bar so the top corners sit off-screen.
export function LiquidTopBar({ children }: { children: ReactNode }) {
  return (
    <LiquidGlass
      cornerRadius={22}
      displacementScale={42}
      blurAmount={0.06}
      saturation={150}
      aberrationIntensity={1.2}
      elasticity={0.06}
      padding="0"
      style={{ position: "fixed", top: "21px", left: "50%", zIndex: 30 }}
    >
      {children}
    </LiquidGlass>
  );
}

export function LiquidDock({ children }: { children: ReactNode }) {
  return (
    <LiquidGlass
      cornerRadius={999}
      displacementScale={56}
      blurAmount={0.05}
      saturation={150}
      aberrationIntensity={1.6}
      elasticity={0.12}
      padding="6px"
      style={{ position: "fixed", top: "calc(100dvh - 42px)", left: "50%", zIndex: 20 }}
    >
      {children}
    </LiquidGlass>
  );
}
