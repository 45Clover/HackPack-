"use client";
// The skill constellation in 3D. Loaded with ssr:false (WebGL needs the browser).
// You are the sun at the centre, your skills are stars, jobs are planets, missing skills are dim hollow stars.
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
  card: ReactNode; // the glass card shown beside the selected node
  width: number;
  height: number;
};

const STAR = "#f2c46d";
const idOf = (end: string | GNode) => (typeof end === "string" ? end : end.id);

// A soft radial glow, drawn once and shared by every node.
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.12)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
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
  const labels = useRef(new Map<string, HTMLDivElement>());
  const reduced = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const css2d = useMemo(() => {
    const r = new CSS2DRenderer();
    r.domElement.style.pointerEvents = "none"; // labels never block clicks; the card turns them back on
    return r;
  }, []);
  const textures = useMemo(() => ({ glow: glowTexture(), ring: ringTexture() }), []);

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
      for (const [id, el] of labels.current) {
        const degree = neighbours.get(id)?.size ?? 0;
        const show = id === "me" || id === focus || !!near?.has(id) || (!focus && id.startsWith("s:") && degree >= 4);
        el.dataset.show = String(show);
      }
    },
    [neighbours],
  );

  // Deep space: a few thousand stars on a huge sphere, drifting slowly.
  useEffect(() => {
    const graph = fg.current;
    if (!graph) return;
    const count = 2600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1600 + Math.random() * 1800;
      const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false }));
    graph.scene().add(stars);
    graph.d3Force("charge")?.strength(-140);
    graph.d3Force("link")?.distance((l: GLink) => (l.kind === "mine" ? 38 : 58));
    let raf = 0;
    const drift = () => {
      stars.rotation.y += 0.00006;
      raf = requestAnimationFrame(drift);
    };
    if (!reduced) raf = requestAnimationFrame(drift);
    return () => {
      cancelAnimationFrame(raf);
      graph.scene().remove(stars);
      geo.dispose();
    };
  }, [reduced]);

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
      graph?.zoomToFit(reduced ? 0 : 800, 90); // closing a card pulls back to the whole constellation
      return;
    }
    const node = data.nodes.find((n) => n.id === selectedId);
    if (!graph || !node || !cardHost) return;
    const obj = new CSS2DObject(cardHost);
    graph.scene().add(obj);
    let raf = 0;
    const follow = () => {
      obj.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      raf = requestAnimationFrame(follow);
    };
    follow();
    const d = Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0);
    const ratio = d < 1 ? 0 : 1 + 300 / d;
    graph.cameraPosition(
      d < 1 ? { x: 0, y: 0, z: 360 } : { x: (node.x ?? 0) * ratio, y: (node.y ?? 0) * ratio, z: (node.z ?? 0) * ratio },
      { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 },
      reduced ? 0 : 1100,
    );
    return () => {
      cancelAnimationFrame(raf);
      graph.scene().remove(obj); // CSS2DObject removes its element on "removed"
    };
    // cardHost changes exactly when the selection does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardHost, data]);

  // Stable, so selecting a node doesn't rebuild every node; it only changes when your skills do.
  const nodeObject = useCallback(
    (n: GNode) => {
      const group = new THREE.Group();
      const isHave = n.kind === "skill" && !!n.slug && have.has(n.slug);
      const isLearning = n.kind === "skill" && !!n.slug && learning.has(n.slug);
      const color = n.kind === "me" ? STAR : n.kind === "job" ? "#e7ebf3" : categoryColor(n.category);
      const size = n.kind === "me" ? 10 : n.kind === "job" ? 4.2 : 3 + Math.sqrt(neighbours.get(n.id)?.size ?? 1) * 1.1;

      if (n.kind === "skill" && !isHave) {
        // A skill you don't have yet: hollow ring (amber if you've started it).
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.ring, color: isLearning ? STAR : color, transparent: true, depthWrite: false, opacity: 0.9 }));
        ring.scale.setScalar(size * 2.4);
        group.add(ring);
      } else {
        const geo = n.kind === "job" ? new THREE.OctahedronGeometry(size) : new THREE.SphereGeometry(size, 24, 24);
        group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color })));
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: n.kind === "skill" && !isHave ? 0.35 : 0.85 }));
      glow.scale.setScalar(size * (n.kind === "me" ? 9 : 6));
      group.add(glow);

      labels.current.get(n.id)?.remove(); // drop the label from the previous build so it does not linger
      const el = document.createElement("div");
      el.className = "graph-label";
      el.textContent = n.label.length > 44 ? `${n.label.slice(0, 42)}…` : n.label;
      const label = new CSS2DObject(el);
      label.position.set(0, -size - 6, 0);
      group.add(label);
      labels.current.set(n.id, el);
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
        backgroundColor="#05070d"
        showNavInfo={false}
        controlType="orbit"
        extraRenderers={[css2d] as never} // CSS2DRenderer works here; three types and 3d-force-graph types disagree
        cooldownTicks={140}
        warmupTicks={30}
        onEngineStop={() => !selectedId && fg.current?.zoomToFit(900, 90)}
        nodeVisibility={(n) => n.kind !== "skill" || !hidden.has(n.category ?? "")}
        linkVisibility={(l) => {
          const t = typeof l.target === "string" ? null : l.target;
          return !t || t.kind !== "skill" || !hidden.has(t.category ?? "");
        }}
        linkColor={(l) => (l.kind === "mine" ? STAR : l.kind === "has" ? "#cfd6e6" : "#59607a")}
        linkOpacity={0.28}
        linkWidth={(l) => (l.kind === "mine" ? 0.6 : 0)}
        linkDirectionalParticles={(l) => (reduced || l.kind !== "mine" ? 0 : 2)}
        linkDirectionalParticleWidth={1.4}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleColor={() => STAR}
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
