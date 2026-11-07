"use client";
// The skill map in 3D. Loaded with ssr:false (WebGL needs the browser).
// Matte spheres on warm white: you (cobalt) at the centre, your skills in their category colour,
// jobs as small black diamonds, skills you're missing as thin hollow rings.
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { categoryColor } from "@/lib/categories";

export type GNode = {
  id: string;
  kind: "me" | "skill" | "job";
  label: string;
  slug?: string;
  category?: string | null;
  jobId?: string;
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
  data: { nodes: GNode[]; links: GLink[] };
  have: Set<string>; // skill slugs you have
  learning: Set<string>; // skill slugs you started
  hidden: Set<string>; // categories filtered out
  selectedId: string | null;
  onSelect: (node: GNode | null) => void;
  card: ReactNode; // the card shown beside the selected node
  width: number;
  height: number;
};

const BLUE = "#2f5bea";
const INK = "#1f1f1d";
const idOf = (end: string | GNode) => (typeof end === "string" ? end : end.id);

// A soft cumulus cloud: overlapping white puffs, a little shade underneath.
function cloudTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  const puff = (x: number, y: number, r: number) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.6)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  for (const [x, y, r] of [[140, 150, 80], [210, 120, 95], [290, 110, 105], [360, 135, 85], [250, 160, 90], [190, 165, 70], [330, 165, 75], [420, 160, 55], [90, 170, 50]]) puff(x, y, r);
  const shade = g.createLinearGradient(0, 120, 0, 230);
  shade.addColorStop(0, "rgba(160,165,178,0)");
  shade.addColorStop(1, "rgba(160,165,178,0.22)");
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = shade;
  g.fillRect(0, 0, 512, 256);
  return new THREE.CanvasTexture(c);
}

// A smooth pebble: an icosphere nudged by low-frequency waves, so each one is lumpy in its own way.
function pebble(radius: number, seed: number) {
  const geo = new THREE.IcosahedronGeometry(radius, 4);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const bump = 1 + 0.1 * Math.sin(v.x * 3 + seed) * Math.cos(v.y * 2.3 + seed * 1.7) + 0.06 * Math.sin(v.z * 4.1 + seed * 0.6);
    v.multiplyScalar(radius * bump);
    v.y *= 0.72; // a little flatter, like a river stone
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

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

export default function Graph3D({ data, have, learning, hidden, selectedId, onSelect, card, width, height }: Props) {
  const fg = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined);
  const labels = useRef(new Map<string, CSS2DObject>());
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settling = useRef(true); // the force layout is still moving
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

  // Labels: you, well-connected skills, and whatever you hover or select (plus their neighbours).
  const paintLabels = useCallback(
    (focus: string | null) => {
      const near = focus ? neighbours.get(focus) : null;
      for (const [id, obj] of labels.current) {
        const degree = neighbours.get(id)?.size ?? 0;
        obj.visible = id === "me" || id === focus || !!near?.has(id) || (!focus && id.startsWith("s:") && degree >= 5);
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
    sleepTimer.current = setTimeout(() => !settling.current && graph.pauseAnimation(), ms);
  }, []);

  // Roomy spacing, a sharp-but-cheap pixel ratio, and wake-on-input.
  useEffect(() => {
    const graph = fg.current;
    if (!graph) return;
    // Depth haze: nodes further from the camera fade toward the paper colour, so near and far read as you orbit.
    graph.scene().fog = new THREE.FogExp2(0xf4f3ef, 0.00045);

    // Backdrop (reference 3): a sea of clouds below and matte stones and spheres far out. They sit outside the
    // camera's reach, so they always stay background, and they slide past each other as you orbit: real parallax.
    const backdrop = new THREE.Group();
    const cloudTex = cloudTexture();
    const clouds: [number, number, number, number][] = [
      [-1500, -620, -900, 1100], [-300, -700, -1700, 1300], [1300, -640, -1100, 1150], [1900, -560, 300, 900],
      [-1900, -580, 500, 950], [400, -760, 1500, 1200], [-900, -680, 1700, 1000], [800, -300, -2300, 1000],
      [-1500, 200, -2000, 850], [2100, 120, -1300, 800],
    ];
    for (const [x, y, z, w] of clouds) {
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 }));
      cloud.position.set(x, y, z);
      cloud.scale.set(w, w / 2, 1);
      backdrop.add(cloud);
    }
    const objects: { geo: THREE.BufferGeometry; color: string; at: [number, number, number] }[] = [
      { geo: new THREE.SphereGeometry(230, 48, 48), color: "#2f5bea", at: [-1250, -380, -1700] },
      { geo: new THREE.SphereGeometry(260, 48, 48), color: "#9aa6b8", at: [1500, -520, -1500] },
      { geo: new THREE.SphereGeometry(150, 48, 48), color: "#ffffff", at: [900, 520, -1800] },
      { geo: pebble(140, 1), color: "#d8cfbf", at: [-1700, -260, -300] },
      { geo: pebble(110, 2), color: "#e6dfd2", at: [1750, -200, 700] },
      { geo: pebble(170, 3), color: "#cfc6b5", at: [-300, -620, 1750] },
      { geo: pebble(90, 4), color: "#bfc7d3", at: [500, 650, 1600] },
    ];
    for (const o of objects) {
      const mesh = new THREE.Mesh(o.geo, new THREE.MeshLambertMaterial({ color: o.color, fog: false }));
      mesh.position.set(...o.at);
      backdrop.add(mesh);
    }
    graph.scene().add(backdrop);
    const controls = graph.controls() as { maxDistance?: number; minDistance?: number };
    controls.maxDistance = 1250; // stay inside the backdrop so it never blocks the map
    controls.minDistance = 90;

    graph.d3Force("charge")?.strength(-340);
    graph.d3Force("link")?.distance((l: GLink) => (l.kind === "mine" ? 80 : 125));

    graph.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Retina at 2x = 4x the pixels to draw

    const canvas = graph.renderer().domElement;
    const onInput = () => wake();
    for (const type of ["pointerdown", "pointermove", "wheel", "touchstart"]) canvas.addEventListener(type, onInput, { passive: true });
    return () => {
      for (const type of ["pointerdown", "pointermove", "wheel", "touchstart"]) canvas.removeEventListener(type, onInput);
      clearTimeout(sleepTimer.current);
      graph.scene().fog = null;
      graph.scene().remove(backdrop);
      backdrop.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      cloudTex.dispose();
    };
  }, [wake]);

  // Anything that changes what's drawn wakes the scene for a moment.
  useEffect(() => {
    wake();
  }, [wake, hidden, have, learning, selectedId]);

  // One host element per selection; the card renders into it through a portal.
  const cardHost = useMemo(() => {
    if (!selectedId) return null;
    const el = document.createElement("div");
    el.style.pointerEvents = "auto";
    return el;
  }, [selectedId]);

  // Show the card beside the selected node and fly the camera to it. The card lives on the scene root and
  // follows the node every frame, so it survives the node objects being rebuilt.
  useEffect(() => {
    const graph = fg.current;
    paintLabels(selectedId);
    if (!selectedId) {
      wake(1400);
      graph?.zoomToFit(reduced ? 0 : 900, 140); // closing a card pulls back to the whole constellation
      return;
    }
    const node = data.nodes.find((n) => n.id === selectedId);
    if (!graph || !node || !cardHost) return;
    const obj = new CSS2DObject(cardHost);
    graph.scene().add(obj);
    let raf = 0;
    const follow = () => {
      obj.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      // Open the card on whichever side has room, so it never slides under the right panel.
      const { x } = graph.graph2ScreenCoords(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      cardHost.dataset.side = x > window.innerWidth * 0.55 ? "left" : "right";
      raf = requestAnimationFrame(follow);
    };
    follow();
    wake(1600); // keep drawing through the camera flight
    const d = Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0);
    const ratio = d < 1 ? 0 : 1 + 340 / d;
    graph.cameraPosition(
      d < 1 ? { x: 0, y: 0, z: 420 } : { x: (node.x ?? 0) * ratio, y: (node.y ?? 0) * ratio, z: (node.z ?? 0) * ratio },
      { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 },
      reduced ? 0 : 1100,
    );
    return () => {
      cancelAnimationFrame(raf);
      graph.scene().remove(obj); // CSS2DObject removes its element on "removed"
    };
    // cardHost changes exactly when the selection does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardHost, data, wake]);

  // Stable, so selecting a node doesn't rebuild every node; it only changes when your skills do.
  const nodeObject = useCallback(
    (n: GNode) => {
      const group = new THREE.Group();
      const isHave = n.kind === "skill" && !!n.slug && have.has(n.slug);
      const isLearning = n.kind === "skill" && !!n.slug && learning.has(n.slug);
      const color = new THREE.Color(n.kind === "me" ? BLUE : n.kind === "job" ? INK : categoryColor(n.category));
      const degree = neighbours.get(n.id)?.size ?? 1;
      const size = n.kind === "me" ? 9 : n.kind === "job" ? 3 : 2.6 + Math.sqrt(degree) * 0.9;

      if (n.kind === "skill" && !isHave) {
        // A skill you don't have yet: a thin hollow ring (cobalt once you've started it).
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.ring, color: isLearning ? new THREE.Color(BLUE) : color, transparent: true, depthWrite: false, opacity: isLearning ? 1 : 0.8 }));
        ring.scale.setScalar(size * 3);
        group.add(ring);
      } else if (n.kind === "job") {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(size), new THREE.MeshLambertMaterial({ color }));
        gem.rotation.set(0.4, 0.6, 0);
        group.add(gem);
      } else {
        group.add(new THREE.Mesh(new THREE.SphereGeometry(size, 24, 24), new THREE.MeshLambertMaterial({ color }))); // matte, lit by the scene lights
      }
      labels.current.get(n.id)?.element.remove(); // drop the label from the previous build so it does not linger
      const el = document.createElement("div");
      el.className = "graph-label";
      el.textContent = n.kind === "me" ? "YOU" : n.label.length > 40 ? `${n.label.slice(0, 38)}…` : n.label;
      el.dataset.kind = n.kind;
      const label = new CSS2DObject(el);
      label.position.set(0, -size - 7, 0);
      group.add(label);
      labels.current.set(n.id, label);
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
          if (!selectedId) fg.current?.zoomToFit(900, 140);
          wake(1200); // let the zoom finish, then sleep
        }}
        nodeVisibility={(n) => n.kind !== "skill" || !hidden.has(n.category ?? "")}
        linkVisibility={(l) => {
          const t = typeof l.target === "string" ? null : l.target;
          return !t || t.kind !== "skill" || !hidden.has(t.category ?? "");
        }}
        linkColor={(l) => (l.kind === "mine" ? BLUE : l.kind === "has" ? "#9c988f" : "#cfcbc2")}
        linkOpacity={0.6}
        linkWidth={0}
        linkCurvature={0.22}
        onNodeHover={(n) => {
          document.body.style.cursor = n ? "pointer" : "";
          paintLabels(n?.id ?? selectedId);
        }}
        onNodeClick={(n) => onSelect(n.kind === "me" ? null : n)}
        onBackgroundClick={() => onSelect(null)}
        nodeThreeObject={nodeObject}
      />
      {cardHost && createPortal(card, cardHost)}
    </>
  );
}
