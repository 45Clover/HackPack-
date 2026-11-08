"use client";
// The landing hero's backdrop: a slow mesh gradient in the app's own colours (paper, pale cobalt, a warm tint) under a
// little film grain, from the `shaders` library (shaders.com, WebGPU). The plain paper gradient (.scene-bg) is always
// underneath, so browsers without WebGPU, and anyone who prefers reduced motion, still get a calm background.
import { useEffect, useState } from "react";
import { FilmGrain, MeshGradient, Shader, getWebGPUSupport } from "shaders/react";

const STOPS = [
  { color: "#fbfaf7", position: 0 },
  { color: "#e6ebfb", position: 0.3 },
  { color: "#c7d3fa", position: 0.55 },
  { color: "#f6e4d6", position: 0.8 },
  { color: "#f4f3ef", position: 1 },
];

export function HeroShader() {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let live = true;
    getWebGPUSupport().then(({ supported }) => live && setOn(supported)).catch(() => {});
    return () => { live = false; };
  }, []);

  return (
    <div aria-hidden className="scene-bg pointer-events-none absolute inset-0 -z-10">
      {on && (
        <Shader
          disableTelemetry
          className={`absolute inset-0 size-full transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}
          onReady={() => setReady(true)}
          onUnavailable={() => setOn(false)}
        >
          <FilmGrain strength={0.12} bias={0}>
            <MeshGradient stops={STOPS} colorSpace="oklab" count={5} smoothness={2} swirl={0.12} drift={0.35} speed={0.15} seed={8} />
          </FilmGrain>
        </Shader>
      )}
    </div>
  );
}
