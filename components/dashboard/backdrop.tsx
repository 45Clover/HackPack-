"use client";
// The backdrop shared by the 3D map and the skill tree: clouds below, matte stones and spheres far out.
// Loaded with ssr:false (WebGL needs the browser).
import { useEffect, useRef } from "react";
import * as THREE from "three";

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

// Backdrop (reference 3): a sea of clouds below and matte stones and spheres far out. The 3D map keeps them outside
// the camera's reach, so they always stay background and slide past each other as you orbit: real parallax.
export function makeBackdrop() {
  const group = new THREE.Group();
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
    group.add(cloud);
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
    group.add(mesh);
  }
  const dispose = () => {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    cloudTex.dispose();
  };
  return { group, dispose };
}

// The same backdrop behind the skill tree, in its own small scene. The camera leans a little toward the pointer,
// so near and far pieces slide past each other (parallax). It only draws while it moves.
export default function TreeBackdrop() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // no WebGL: the plain paper background (.scene-bg) is enough behind the tree
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xcccccc, Math.PI), new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI)); // force-graph's lights
    const backdrop = makeBackdrop();
    scene.add(backdrop.group);
    const camera = new THREE.PerspectiveCamera(55, 1, 10, 8000);
    const look = new THREE.Vector3(0, -350, -1400);
    const rest = new THREE.Vector3(0, 0, 1300);
    const goal = rest.clone();
    let frame = 0;
    const draw = () => {
      camera.position.lerp(goal, 0.08);
      camera.lookAt(look);
      renderer.render(scene, camera);
      frame = camera.position.distanceTo(goal) > 0.5 ? requestAnimationFrame(draw) : 0;
    };
    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      camera.position.copy(goal);
      draw();
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onMove = (e: PointerEvent) => {
      goal.set(rest.x + (e.clientX / innerWidth - 0.5) * 260, rest.y - (e.clientY / innerHeight - 0.5) * 160, rest.z);
      if (!frame) frame = requestAnimationFrame(draw);
    };
    resize();
    addEventListener("resize", resize);
    if (!reduced) addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", resize);
      removeEventListener("pointermove", onMove);
      backdrop.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div ref={host} className="absolute inset-0" />;
}
