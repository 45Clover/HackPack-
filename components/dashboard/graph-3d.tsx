"use client";
// The skill map in 3D. Loaded with ssr:false (WebGL needs the browser).
// Matte spheres on warm white: you (cobalt) at the centre, your skills in their category colour,
// jobs as small black diamonds, skills you're missing as thin hollow rings.
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import gsap from "gsap";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { categoryColor } from "@/lib/categories";
import { makeBackdrop } from "./backdrop";
import { ORBIT_R } from "./orbit";

export type GNode = {
  id: string;
  kind: "me" | "skill" | "job";
  label: string;
  slug?: string;
  category?: string | null;
  jobId?: string;
  title?: string; // jobs: the job title, their always-on label
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  __threeObj?: THREE.Object3D;
};
export type GLink = { source: string | GNode; target: string | GNode; kind: "mine" | "has" | "missing" };

type Props = {
  zoom: number | null; // the zoom slider, 0–100 (null until the first camera move reports it)
  onZoom: (v: number) => void; // tells the slider where the camera ended up (after a flight, a scroll or a drag)
  orbit?: boolean; // the donut layout: look at it from above so the ring reads
  data: { nodes: GNode[]; links: GLink[] };
  have: Set<string>; // skill slugs you have
  learning: Set<string>; // skill slugs you started
  hidden: Set<string>; // categories filtered out
  selectedId: string | null;
  onSelect: (node: GNode | null) => void;
  hoverId: string | null; // a row hovered in the sidebar: light up that node and its neighbours
  mini: (n: GNode) => ReactNode; // small card for each neighbour of the selected node
  width: number;
  height: number;
  autoRotate?: boolean; // the landing page: turn slowly on its own, and stay awake while turning
};

const BLUE = "#2f5bea";
const INK = "#1f1f1d";
const idOf = (end: string | GNode) => (typeof end === "string" ? end : end.id);

function ringTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.lineWidth = 7;
  g.beginPath();
  g.arc(64, 64, 44, 0, Math.PI * 2);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

// Zoom slider (0–100) ↔ camera distance from the orbit target, on a log scale between the orbit limits.
const MIN_D = 90, MAX_D = 1250;
const distanceToZoom = (d: number) => Math.min(100, Math.max(0, (100 * Math.log(MAX_D / d)) / Math.log(MAX_D / MIN_D)));
const zoomToDistance = (v: number) => MAX_D * Math.pow(MIN_D / MAX_D, v / 100);

export default function Graph3D({ zoom, onZoom, orbit, data, have, learning, hidden, selectedId, onSelect, hoverId, mini, width, height, autoRotate }: Props) {
  const fg = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined);
  const labels = useRef(new Map<string, CSS2DObject>());
  const groups = useRef(new Map<string, THREE.Group>());
  const carded = useRef(new Set<string>()); // nodes showing a card, so their label stays hidden
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settling = useRef(true); // the force layout is still moving
  const spinning = useRef(false); // autoRotate is on, so the scene never sleeps
  const reduced = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const css2d = useMemo(() => {
    const r = new CSS2DRenderer();
    r.domElement.style.pointerEvents = "none"; // labels never block clicks; the card turns them back on
    return r;
  }, []);
  const textures = useMemo(() => ({ ring: ringTexture() }), []);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of data.links) {
      const a = idOf(l.source), b = idOf(l.target);
      (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
      (m.get(b) ?? m.set(b, new Set()).get(b)!).add(a);
    }
    return m;
  }, [data]);

  const selectedRef = useRef(selectedId);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  // Labels: well-connected skills, and whatever you hover or select (plus their neighbours).
  const paintLabels = useCallback(
    (focus: string | null) => {
      const near = focus ? neighbours.get(focus) : null;
      for (const [id, obj] of labels.current) {
        const degree = neighbours.get(id)?.size ?? 0;
        obj.visible = !carded.current.has(id) && (id === focus || !!near?.has(id) || (!focus && (id.startsWith("j:") || (id.startsWith("s:") && degree >= 5))));
        // The hovered/selected node shows its whole name; everything else stays short.
        const el = obj.element;
        const text = id === focus ? el.dataset.full! : el.dataset.short!;
        if (el.textContent !== text) el.textContent = text;
        el.toggleAttribute("data-focus", id === focus);
      }
    },
    [neighbours],
  );

  // Performance: the scene only redraws while something moves (layout settling, you dragging/zooming, a camera flight).
  // When it sleeps, the browser has nothing to repaint, which is what made it lag before.
  const wake = useCallback((ms = 2500) => {
    const graph = fg.current;
    if (!graph) return;
    graph.resumeAnimation();
    clearTimeout(sleepTimer.current);
    sleepTimer.current = setTimeout(() => !settling.current && !spinning.current && graph.pauseAnimation(), ms);
  }, []);

  const reportZoom = useCallback(() => {
    const graph = fg.current;
    if (graph) onZoom(distanceToZoom(graph.camera().position.distanceTo((graph.controls() as { target: THREE.Vector3 }).target)));
  }, [onZoom]);

  // Camera moves run on GSAP (one clock for the whole app). The framing is force-graph's zoomToFit, ported:
  // back off along the view direction until every corner of the box fits. `forward` overrides the view direction.
  const flight = useRef<gsap.core.Tween | undefined>(undefined);
  const flyTo = useCallback(
    (secs: number, padding: number, filter?: (n: GNode) => boolean, forward?: THREE.Vector3) => {
      const graph = fg.current;
      const box = graph?.getGraphBbox(filter);
      if (!graph || !box) return;
      const camera = graph.camera() as THREE.PerspectiveCamera;
      const target = (graph.controls() as { target: THREE.Vector3 }).target;
      camera.updateMatrixWorld();
      const fwd = forward ?? camera.getWorldDirection(new THREE.Vector3());
      const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
      const vHalf = ((((1 - (padding * 2) / height) * camera.fov) / 2) * Math.PI) / 180;
      const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
      const center = new THREE.Vector3((box.x[0] + box.x[1]) / 2, (box.y[0] + box.y[1]) / 2, (box.z[0] + box.z[1]) / 2);
      let distance = 0;
      for (const x of box.x) for (const y of box.y) for (const z of box.z) {
        const c = new THREE.Vector3(x, y, z).sub(center);
        distance = Math.max(distance, Math.max(Math.abs(c.dot(up)) / Math.tan(vHalf), Math.abs(c.dot(right)) / Math.tan(hHalf)) - c.dot(fwd));
      }
      const from = { pos: camera.position.clone(), look: target.clone() };
      const to = { pos: center.clone().addScaledVector(fwd, -distance), look: center };
      const t = { k: 0 };
      flight.current?.kill();
      wake((secs + 0.4) * 1000); // keep drawing through the move
      flight.current = gsap.to(t, {
        k: 1,
        duration: reduced ? 0 : secs,
        ease: "power2.inOut",
        onUpdate: () => graph.cameraPosition(from.pos.clone().lerp(to.pos, t.k), from.look.clone().lerp(to.look, t.k), 0),
        onComplete: reportZoom,
      });
    },
    [height, reduced, wake, reportZoom],
  );

  // The slider moved: slide the camera along its line of sight to the matching distance.
  useEffect(() => {
    const graph = fg.current;
    if (!graph || zoom === null) return;
    const target = (graph.controls() as { target: THREE.Vector3 }).target;
    const camera = graph.camera();
    if (Math.abs(distanceToZoom(camera.position.distanceTo(target)) - zoom) < 0.5) return; // already there
    flight.current?.kill();
    graph.cameraPosition(camera.position.clone().sub(target).setLength(zoomToDistance(zoom)).add(target), target, 0);
    wake(600);
  }, [zoom, wake]);

  // Entrance: start high above the map and drift down to the front view while the layout settles.
  useEffect(() => {
    fg.current?.cameraPosition({ x: 0, y: 1100, z: 1500 }, { x: 0, y: 0, z: 0 }, 0);
    const t = setTimeout(() => flyTo(2.4, 140, undefined, orbit ? new THREE.Vector3(0, -0.75, -1).normalize() : new THREE.Vector3(0, 0, -1)), 60);
    return () => clearTimeout(t);
    // once, when the map mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autoRotate: OrbitControls turns the camera every frame (about two minutes a lap). Reduced motion: no turning.
  useEffect(() => {
    const graph = fg.current;
    if (!graph || !autoRotate || reduced) return;
    const controls = graph.controls() as { autoRotate: boolean; autoRotateSpeed: number };
    controls.autoRotateSpeed = 0.5;
    spinning.current = controls.autoRotate = true;
    graph.resumeAnimation();
    return () => {
      spinning.current = controls.autoRotate = false;
    };
  }, [autoRotate, reduced]);

  // Orbit layout: a faint ring through the skills, so the donut reads as an orbit.
  useEffect(() => {
    const graph = fg.current;
    if (!orbit || !graph) return;
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => new THREE.Vector3(ORBIT_R * Math.cos((i / 128) * 2 * Math.PI), 0, ORBIT_R * Math.sin((i / 128) * 2 * Math.PI)))),
      new THREE.LineBasicMaterial({ color: 0xcfcbc2 }),
    );
    graph.scene().add(ring);
    return () => {
      graph.scene().remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    };
  }, [orbit]);

  // Roomy spacing, a sharp-but-cheap pixel ratio, and wake-on-input.
  useEffect(() => {
    const graph = fg.current;
    if (!graph) return;
    // Depth haze: nodes further from the camera fade toward the paper colour, so near and far read as you orbit.
    graph.scene().fog = new THREE.FogExp2(0xf4f3ef, 0.00045);

    const backdrop = makeBackdrop();
    graph.scene().add(backdrop.group);
    const controls = graph.controls() as { maxDistance?: number; minDistance?: number };
    controls.maxDistance = MAX_D; // stay inside the backdrop so it never blocks the map
    controls.minDistance = MIN_D;

    graph.d3Force("charge")?.strength(-340);
    graph.d3Force("link")?.distance((l: GLink) => (l.kind === "mine" ? 80 : 125));

    graph.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Retina at 2x = 4x the pixels to draw

    (graph.controls() as unknown as THREE.EventDispatcher<{ end: object }>).addEventListener("end", reportZoom); // scroll or drag finished
    const canvas = graph.renderer().domElement;
    const onInput = () => wake();
    for (const type of ["pointerdown", "pointermove", "wheel", "touchstart"]) canvas.addEventListener(type, onInput, { passive: true });
    return () => {
      for (const type of ["pointerdown", "pointermove", "wheel", "touchstart"]) canvas.removeEventListener(type, onInput);
      (graph.controls() as unknown as THREE.EventDispatcher<{ end: object }>).removeEventListener("end", reportZoom);
      clearTimeout(sleepTimer.current);
      graph.scene().fog = null;
      graph.scene().remove(backdrop.group);
      backdrop.dispose();
    };
  }, [wake, reportZoom]);

  // Anything that changes what's drawn wakes the scene for a moment.
  useEffect(() => {
    wake();
  }, [wake, hidden, have, learning, selectedId]);

  const near = useMemo(() => (selectedId ? neighbours.get(selectedId) ?? new Set<string>() : null), [selectedId, neighbours]);
  const inFocus = (id: string) => !selectedId || id === selectedId || !!near?.has(id);

  // Up to 6 neighbours of the selected node get their own small card (your second sketch); more would pile up.
  const miniHosts = useMemo(() => {
    const m = new Map<string, HTMLDivElement>();
    if (!near) return m;
    const ids = [...near].filter((id) => {
      const n = data.nodes.find((x) => x.id === id);
      return n && (n.kind !== "skill" || !hidden.has(n.category ?? ""));
    });
    for (const id of ids.slice(0, 6)) {
      const el = document.createElement("div");
      el.style.pointerEvents = "auto";
      m.set(id, el);
    }
    return m;
  }, [near, data, hidden]);

  // Hover from the sidebar (or the selection): everything outside that neighbourhood fades back.
  useEffect(() => {
    const focus = hoverId ?? selectedId;
    const lit = focus ? new Set([focus, ...(neighbours.get(focus) ?? [])]) : null;
    for (const [id, group] of groups.current) {
      group.traverse((o) => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
        const mat = o.material as THREE.Material & { opacity: number };
        mat.opacity = !lit || lit.has(id) ? (mat.userData.base ?? 1) : 0.12;
      });
    }
    paintLabels(focus);
    wake();
  }, [hoverId, selectedId, neighbours, paintLabels, wake]);

  // Selecting a node: a small card on each neighbour, and frame just that neighbourhood.
  // The cards live on the scene root and follow their nodes every frame, so they survive node rebuilds.
  useEffect(() => {
    const graph = fg.current;
    carded.current = new Set(miniHosts.keys());
    paintLabels(selectedId);
    if (!selectedId) {
      wake(1400);
      flyTo(0.9, 140); // closing a card pulls back to the whole map
      return;
    }
    const node = data.nodes.find((n) => n.id === selectedId);
    if (!graph || !node) return;
    const pinned: [CSS2DObject, GNode][] = [];
    for (const [id, host] of miniHosts) {
      const n = data.nodes.find((x) => x.id === id);
      if (n) pinned.push([new CSS2DObject(host), n]);
    }
    for (const [obj] of pinned) graph.scene().add(obj);
    let raf = 0;
    const follow = () => {
      for (const [obj, n] of pinned) obj.position.set(n.x ?? 0, n.y ?? 0, n.z ?? 0);
      raf = requestAnimationFrame(follow);
    };
    follow();
    wake(1800); // keep drawing through the camera move
    flyTo(1, 160, (n: GNode) => n.id === selectedId || !!near?.has(n.id));
    return () => {
      cancelAnimationFrame(raf);
      for (const [obj] of pinned) graph.scene().remove(obj); // CSS2DObject removes its element on "removed"
    };
    // miniHosts changes exactly when the selection does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniHosts, data, wake, flyTo]);

  // Each neighbour card unfolds out of its node, one after another. Stable, so re-renders don't replay it.
  const unfold = useCallback(
    (el: HTMLElement | null) => {
      if (!el || reduced) return;
      gsap.fromTo(el, { opacity: 0, scale: 0.85, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "power3.out", delay: Number(el.dataset.i) * 0.06, transformOrigin: "50% 100%" });
    },
    [reduced],
  );

  // Stable, so selecting a node doesn't rebuild every node; it only changes when your skills do.
  const nodeObject = useCallback(
    (n: GNode) => {
      const group = new THREE.Group();
      const isHave = n.kind === "skill" && !!n.slug && have.has(n.slug);
      const isLearning = n.kind === "skill" && !!n.slug && learning.has(n.slug);
      const color = new THREE.Color(n.kind === "job" ? INK : categoryColor(n.category));
      const degree = neighbours.get(n.id)?.size ?? 1;
      const size = n.kind === "job" ? 8 : 2.6 + Math.sqrt(degree) * 0.9;

      if (n.kind === "skill" && !isHave) {
        // A skill you don't have yet: a thin hollow ring (cobalt once you've started it).
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.ring, color: isLearning ? new THREE.Color(BLUE) : color, transparent: true, depthWrite: false, opacity: isLearning ? 1 : 0.8, userData: { base: isLearning ? 1 : 0.8 } }));
        ring.scale.setScalar(size * 3);
        group.add(ring);
      } else if (n.kind === "job") {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(size), new THREE.MeshLambertMaterial({ color, transparent: true }));
        gem.rotation.set(0.4, 0.6, 0);
        group.add(gem);
      } else {
        group.add(new THREE.Mesh(new THREE.SphereGeometry(size, 24, 24), new THREE.MeshLambertMaterial({ color, transparent: true }))); // matte, lit by the scene lights
      }
      labels.current.get(n.id)?.element.remove(); // drop the label from the previous build so it does not linger
      const el = document.createElement("div");
      el.className = "graph-label";
      el.dataset.full = n.label;
      // Jobs show their title until you hover them (then title · company); skills show their name. Long ones get cut.
      const name = n.title ?? n.label;
      el.dataset.short = name.length > 34 ? `${name.slice(0, 32)}…` : name;
      el.textContent = el.dataset.short;
      el.dataset.kind = n.kind;
      const label = new CSS2DObject(el);
      label.position.set(0, -size - 7, 0);
      group.add(label);
      labels.current.set(n.id, label);
      groups.current.set(n.id, group);
      queueMicrotask(() => paintLabels(selectedRef.current));
      return group;
    },
    [have, learning, neighbours, textures, paintLabels],
  );

  return (
    <>
      <ForceGraph3D<GNode, GLink>
        ref={fg}
        graphData={data}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)" // transparent: the lit backdrop lives in CSS (.scene-bg)
        showNavInfo={false}
        controlType="orbit"
        extraRenderers={[css2d] as never} // CSS2DRenderer works here; three types and 3d-force-graph types disagree
        cooldownTicks={180}
        warmupTicks={30}
        onEngineStop={() => {
          settling.current = false;
          if (!selectedId) flyTo(0.9, 140);
        }}
        nodeVisibility={(n) => (n.kind !== "skill" || !hidden.has(n.category ?? "")) && inFocus(n.id)}
        linkVisibility={(l) => {
          const t = typeof l.target === "string" ? null : l.target;
          const ends = !selectedId || idOf(l.source) === selectedId || idOf(l.target) === selectedId;
          return ends && (!t || t.kind !== "skill" || !hidden.has(t.category ?? ""));
        }}
        linkColor={(l) => {
          const focus = hoverId;
          if (focus && idOf(l.source) !== focus && idOf(l.target) !== focus) return "#e6e3dc"; // faded while you hover a row
          return l.kind === "has" ? "#9c988f" : "#cfcbc2";
        }}
        linkOpacity={0.6}
        linkWidth={0}
        linkCurvature={0.22}
        onNodeHover={(n) => {
          document.body.style.cursor = n ? "pointer" : "";
          paintLabels(n?.id ?? hoverId ?? selectedId);
        }}
        onNodeClick={(n) => onSelect(n)}
        onBackgroundClick={() => onSelect(null)}
        nodeThreeObject={nodeObject}
      />
      {[...miniHosts].map(([id, host], i) => {
        const n = data.nodes.find((x) => x.id === id);
        return n
          ? createPortal(
              <div className="mini-wrap">
                <button ref={unfold} data-i={i} className="surface block max-w-[200px] rounded-2xl px-3 py-2 text-left text-xs text-foreground hover:ring-1 hover:ring-foreground/20" onClick={() => onSelect(n)}>
                  {mini(n)}
                </button>
              </div>,
              host,
              id,
            )
          : null;
      })}
    </>
  );
}
