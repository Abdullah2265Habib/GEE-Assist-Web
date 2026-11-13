import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "./terrain3d.css";

/**
 * An interactive 3D tile of land, the kind of area GEE-Assist downloads. The visitor
 * turns it by dragging, points at it to read values, switches the analysis layer
 * (a satellite flies over and re-images the ground as it changes), and can pull the
 * tile apart into the spectral bands the layers are computed from.
 *
 * The land is generated, not real data.
 */

export type Layer = "true" | "ndvi" | "water" | "lst" | "change";

const LAYERS: { id: Layer; label: string; formula: string; legend?: [string, string, string] }[] = [
  { id: "true", label: "True colour", formula: "Bands B4, B3, B2 shown as red, green and blue." },
  {
    id: "ndvi",
    label: "Vegetation",
    formula: "NDVI = (B8 − B4) / (B8 + B4). Healthy plants reflect near-infrared and absorb red.",
    legend: ["-0.2", "NDVI", "0.9"],
  },
  {
    id: "water",
    label: "Water",
    formula: "NDWI = (B3 − B8) / (B3 + B8). Above zero is open water.",
    legend: ["land", "NDWI", "water"],
  },
  {
    id: "lst",
    label: "Temperature",
    formula: "Land surface temperature from Landsat's thermal band, in °C.",
    legend: ["15 °C", "LST", "45 °C"],
  },
  {
    id: "change",
    label: "Land cover change",
    formula: "2019 compared with 2024: red cleared, amber newly built, green regrown.",
  },
];

const BANDS = [
  { id: "B2", name: "Blue", tint: "#4d8df7" },
  { id: "B3", name: "Green", tint: "#45c46a" },
  { id: "B4", name: "Red", tint: "#ef5350" },
  { id: "B8", name: "Near-infrared", tint: "#c17cf2" },
];

const N = 128;
const VN = N + 1;
const SIZE = 10;
const HEIGHT = 1.7;
const BASE = -0.7;

/* ---------- the land ---------- */

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number) {
  let t = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    t += a * noise(x * f, y * f);
    f *= 2;
    a *= 0.5;
  }
  return t;
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function smooth(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

const Change = { None: 0, Cleared: 1, Built: 2, Regrown: 3 } as const;

interface Field {
  elev: Float32Array;
  veg: Float32Array;
  temp: Float32Array;
  water: Uint8Array;
  urban: Uint8Array;
  change: Uint8Array;
}

function makeField(): Field {
  const n = VN * VN;
  const f: Field = {
    elev: new Float32Array(n),
    veg: new Float32Array(n),
    temp: new Float32Array(n),
    water: new Uint8Array(n),
    urban: new Uint8Array(n),
    change: new Uint8Array(n),
  };
  for (let j = 0; j < VN; j++) {
    for (let i = 0; i < VN; i++) {
      const u = i / N;
      const v = j / N;
      const k = j * VN + i;

      let e = fbm(u * 3 + 1.3, v * 3 + 0.7) * 0.75;
      e += smooth(0.55, 0.0, v) * 0.75 * fbm(u * 5 + 7, v * 5 + 2);

      const rv = 0.64 + 0.09 * Math.sin(u * 6.3 + 0.5) + 0.035 * Math.sin(u * 17);
      const d = Math.abs(v - rv);
      e = lerp(0.1, e, smooth(0.02, 0.17, d));

      const ld = Math.hypot(u - 0.8, (v - 0.33) * 1.2);
      e = lerp(0.1, e, smooth(0.07, 0.15, ld));

      const cd = Math.hypot(u - 0.33, (v - 0.84) * 1.1);
      const ring = 0.02 * Math.sin(Math.atan2(v - 0.84, u - 0.33) * 5);
      if (cd < 0.15) e = lerp(e, 0.15, 0.7 * smooth(0.15, 0.08, cd));

      const water = d < 0.022 || ld < 0.078;
      const urbanNow = !water && cd < 0.125 + ring;
      const urbanThen = !water && cd < 0.085 + ring;

      let veg = clamp(0.1 + 1.0 * (fbm(u * 5 + 11, v * 5 + 3) - 0.2));
      veg = clamp(veg + 0.3 * smooth(0.1, 0.03, d) - Math.max(0, e - 0.7) * 1.3, 0, 0.92);

      let change: number = Change.None;
      if (Math.hypot((u - 0.64) / 1.5, v - 0.17) < 0.075 && !water) {
        change = Change.Cleared;
        veg = 0.16 + 0.05 * noise(u * 40, v * 40);
      } else if (Math.hypot(u - 0.13, v - 0.42) < 0.06 && !water) {
        change = Change.Regrown;
        veg = Math.max(veg, 0.78);
      }
      if (urbanNow) {
        veg = 0.05 + 0.08 * noise(u * 60, v * 60);
        if (!urbanThen) change = Change.Built;
      }
      if (water) {
        e = 0.08;
        veg = -0.1;
      }

      f.elev[k] = e;
      f.veg[k] = veg;
      f.water[k] = water ? 1 : 0;
      f.urban[k] = urbanNow ? 1 : 0;
      f.change[k] = change;
      f.temp[k] = water
        ? 19 + 1.5 * noise(u * 9, v * 9)
        : 23 + 17 * (1 - clamp(veg)) - e * 9 + (urbanNow ? 7 : 0) + 2 * noise(u * 12, v * 12);
    }
  }
  return f;
}

/** Surface reflectance of each Sentinel-2 band at one point: [B2, B3, B4, B8]. */
function reflectance(f: Field, k: number): [number, number, number, number] {
  if (f.water[k]) return [0.07, 0.06, 0.035, 0.012];
  if (f.urban[k]) return [0.14, 0.16, 0.18, 0.22];
  const g = clamp(f.veg[k]);
  const rock = smooth(0.8, 1.05, f.elev[k]);
  const soil: [number, number, number, number] = [0.1, 0.14, 0.2, 0.27];
  const plant: [number, number, number, number] = [0.035, 0.08, 0.04, 0.46];
  return soil.map((s, b) => lerp(lerp(s, plant[b], g), [0.2, 0.21, 0.22, 0.26][b], rock)) as [number, number, number, number];
}

const ndviAt = (f: Field, k: number) => {
  const [, , r, n] = reflectance(f, k);
  return (n - r) / (n + r);
};
const ndwiAt = (f: Field, k: number) => {
  const [, g, , n] = reflectance(f, k);
  return (g - n) / (g + n);
};

function ramp(stops: [number, string][], x: number, out: THREE.Color) {
  const t = clamp(x, stops[0][0], stops[stops.length - 1][0]);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      return out.set(ca).lerp(new THREE.Color(cb), (t - a) / (b - a || 1));
    }
  }
  return out.set(stops[stops.length - 1][1]);
}

const NDVI_STOPS: [number, string][] = [
  [-0.2, "#3d5a80"],
  [0.05, "#a5642a"],
  [0.3, "#e8d36a"],
  [0.6, "#7fc35a"],
  [0.9, "#17602a"],
];
const LST_STOPS: [number, string][] = [
  [15, "#2c5fa8"],
  [24, "#7cc1d8"],
  [31, "#f2d06b"],
  [38, "#e8743a"],
  [45, "#b8232b"],
];
const NDWI_STOPS: [number, string][] = [
  [-0.8, "#1c2629"],
  [-0.2, "#3a4a50"],
  [0.0, "#6a8a94"],
  [0.2, "#3aa8f5"],
  [0.7, "#1366c9"],
];

function layerColors(f: Field, layer: Layer): Float32Array {
  const out = new Float32Array(VN * VN * 3);
  const c = new THREE.Color();
  const grey = new THREE.Color();
  for (let k = 0; k < VN * VN; k++) {
    if (layer === "true" || layer === "change") {
      const [b, g, r] = reflectance(f, k);
      const gain = 3.4;
      c.setRGB(clamp(r * gain), clamp(g * gain), clamp(b * gain), THREE.SRGBColorSpace);
      if (f.water[k]) c.set("#1d4f73");
      if (layer === "change") {
        const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
        grey.setRGB(l, l, l);
        c.lerp(grey, 0.75);
        const ch = f.change[k];
        if (ch === Change.Cleared) c.set("#e5484d");
        else if (ch === Change.Built) c.set("#f59e0b");
        else if (ch === Change.Regrown) c.set("#30c27a");
      }
    } else if (layer === "ndvi") {
      ramp(NDVI_STOPS, ndviAt(f, k), c);
    } else if (layer === "water") {
      ramp(NDWI_STOPS, ndwiAt(f, k), c);
    } else {
      ramp(LST_STOPS, f.temp[k], c);
    }
    out[k * 3] = c.r;
    out[k * 3 + 1] = c.g;
    out[k * 3 + 2] = c.b;
  }
  return out;
}

function landClass(f: Field, k: number) {
  if (f.water[k]) return "Water";
  if (f.urban[k]) return "Built-up";
  if (f.elev[k] > 0.92) return "Bare rock";
  const g = f.veg[k];
  if (g > 0.62) return "Forest";
  if (g > 0.32) return "Cropland and grass";
  return "Bare soil";
}

export interface Reading {
  title: string;
  value: string;
  detail: string;
}

function readAt(f: Field, k: number, layer: Layer): Reading {
  const elevation = `${Math.round(240 + f.elev[k] * 1100)} m`;
  const cls = landClass(f, k);
  switch (layer) {
    case "ndvi":
      return { title: "NDVI", value: ndviAt(f, k).toFixed(2), detail: `${cls} · ${elevation}` };
    case "water": {
      const w = ndwiAt(f, k);
      return { title: "NDWI", value: w.toFixed(2), detail: w > 0 ? "Open water" : `Land · ${elevation}` };
    }
    case "lst":
      return { title: "Surface temperature", value: `${f.temp[k].toFixed(1)} °C`, detail: `${cls} · ${elevation}` };
    case "change": {
      const ch = f.change[k];
      const value =
        ch === Change.Cleared
          ? "Forest cleared"
          : ch === Change.Built
            ? "Newly built"
            : ch === Change.Regrown
              ? "Regrown"
              : "No change";
      return { title: "2019 → 2024", value, detail: cls };
    }
    default:
      return { title: "Land cover", value: cls, detail: `Elevation ${elevation}` };
  }
}

/* ---------- geometry ---------- */

function terrainGeometry(f: Field) {
  const pos = new Float32Array(VN * VN * 3);
  for (let j = 0; j < VN; j++) {
    for (let i = 0; i < VN; i++) {
      const k = j * VN + i;
      pos[k * 3] = (i / N - 0.5) * SIZE;
      pos[k * 3 + 1] = f.elev[k] * HEIGHT;
      pos[k * 3 + 2] = (j / N - 0.5) * SIZE;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * VN + i;
      const b = a + 1;
      const c = a + VN;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(VN * VN * 3), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The four sides of the block, from the surface down to the base, so the tile reads as a solid slice of ground. */
function skirtGeometry(f: Field) {
  const edges: number[][] = [
    Array.from({ length: VN }, (_, i) => i),
    Array.from({ length: VN }, (_, i) => N * VN + i),
    Array.from({ length: VN }, (_, j) => j * VN),
    Array.from({ length: VN }, (_, j) => j * VN + N),
  ];
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const top = new THREE.Color("#7a5a3a");
  const mid = new THREE.Color("#5c4330");
  const bottom = new THREE.Color("#33261c");
  for (const edge of edges) {
    const start = pos.length / 3;
    for (const k of edge) {
      const i = k % VN;
      const j = Math.floor(k / VN);
      const x = (i / N - 0.5) * SIZE;
      const z = (j / N - 0.5) * SIZE;
      const y = f.elev[k] * HEIGHT;
      pos.push(x, y, z, x, (y + BASE) / 2, z, x, BASE, z);
      const t = f.water[k] ? new THREE.Color("#1d4f73") : top;
      col.push(t.r, t.g, t.b, mid.r, mid.g, mid.b, bottom.r, bottom.g, bottom.b);
    }
    for (let s = 0; s < edge.length - 1; s++) {
      const a = start + s * 3;
      const b = a + 3;
      idx.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function bandTexture(f: Field, band: number) {
  const canvas = document.createElement("canvas");
  canvas.width = VN;
  canvas.height = VN;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(VN, VN);
  for (let k = 0; k < VN * VN; k++) {
    const v = Math.round(clamp(reflectance(f, k)[band] / 0.46) ** 0.7 * 255);
    img.data[k * 4] = v;
    img.data[k * 4 + 1] = v;
    img.data[k * 4 + 2] = v;
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSatellite() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: "#d4a94a", metalness: 0.65, roughness: 0.35 });
  const panel = new THREE.MeshStandardMaterial({ color: "#2f5f9e", metalness: 0.35, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: "#1b2226", metalness: 0.4, roughness: 0.5 });
  const strut = new THREE.MeshStandardMaterial({ color: "#aab6bb", metalness: 0.7, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), gold);
  g.add(body);
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.025, 0.42), panel);
    p.position.x = side * 0.98;
    g.add(p);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), strut);
    s.rotation.z = Math.PI / 2;
    s.position.x = side * 0.33;
    g.add(s);
  }
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.16, 20), dark);
  lens.position.y = -0.32;
  g.add(lens);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 20, 1, true), strut);
  dish.position.y = 0.32;
  dish.rotation.x = Math.PI;
  g.add(dish);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  g.scale.setScalar(0.85);
  return g;
}

/* ---------- component ---------- */

interface Api {
  setLayer: (l: Layer) => void;
  setExploded: (b: boolean) => void;
  /** Re-read the point under the pointer after the layer changes. */
  refresh: () => void;
}

export default function Terrain3D() {
  const hostRef = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [layer, setLayer] = useState<Layer>("true");
  const [exploded, setExploded] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState(false);
  const layerRef = useRef<Layer>("true");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    camera.position.set(11.6, 10.4, 14.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.32;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.6;
    controls.target.set(0, 0.6, 0);
    const baseDistance = camera.position.distanceTo(controls.target);
    const offset = new THREE.Vector3();
    // Let vertical swipes scroll the page on phones; horizontal drags turn the tile.
    renderer.domElement.style.touchAction = "pan-y";

    scene.add(new THREE.HemisphereLight("#dfefff", "#3a2e22", 1.1));
    const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
    sun.position.set(-7, 11, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    const field = makeField();
    const colors: Record<Layer, Float32Array> = {
      true: layerColors(field, "true"),
      ndvi: layerColors(field, "ndvi"),
      water: layerColors(field, "water"),
      lst: layerColors(field, "lst"),
      change: layerColors(field, "change"),
    };

    const geo = terrainGeometry(field);
    const colorAttr = geo.getAttribute("color") as THREE.BufferAttribute;
    (colorAttr.array as Float32Array).set(colors.true);
    const terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    );
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);

    const skirt = new THREE.Mesh(
      skirtGeometry(field),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    );
    scene.add(skirt);

    // Bands, stacked above the tile when pulled apart. Top to bottom: B2, B3, B4, B8.
    const bandPlanes = BANDS.map((b, i) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(SIZE, SIZE),
        new THREE.MeshBasicMaterial({
          map: bandTexture(field, i),
          color: b.tint,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(m.geometry),
        new THREE.LineBasicMaterial({ color: b.tint, transparent: true, opacity: 0 }),
      );
      m.add(edge);
      return m;
    });

    const sat = makeSatellite();
    sat.position.set(4.5, 5.6, 0);
    scene.add(sat);

    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    const beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: "#5ed3a8",
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    beam.visible = false;
    scene.add(beam);

    const scanGeo = new THREE.BufferGeometry();
    scanGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(VN * 3), 3));
    const scan = new THREE.Line(scanGeo, new THREE.LineBasicMaterial({ color: "#b6ffe3" }));
    scan.visible = false;
    scene.add(scan);

    const marker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.19, 32),
      new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide, depthTest: false, transparent: true }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 5;
    marker.add(ring);
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.9),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85 }),
    );
    pin.position.y = 0.45;
    marker.add(pin);
    marker.visible = false;
    scene.add(marker);

    // Layer change: a sweep from west to east, led by the satellite.
    let sweep: { from: Float32Array; to: Float32Array; start: number } | null = null;
    const SWEEP = reduce ? 0.001 : 1.7;
    const LEAD = reduce ? 0 : 0.45;
    let explode = 0;
    let explodeTarget = 0;
    let clock = 0;

    api.current = {
      setLayer(l) {
        sweep = { from: Float32Array.from(colorAttr.array as Float32Array), to: colors[l], start: clock };
      },
      setExploded(b) {
        explodeTarget = b ? 1 : 0;
      },
      refresh() {
        if (lastK >= 0) setReading(readAt(field, lastK, layerRef.current));
      },
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let lastK = -1;
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(terrain, false)[0];
      if (!hit) {
        marker.visible = false;
        if (lastK !== -1) {
          lastK = -1;
          setReading(null);
        }
        return;
      }
      const i = Math.round(clamp(hit.point.x / SIZE + 0.5) * N);
      const j = Math.round(clamp(hit.point.z / SIZE + 0.5) * N);
      const k = j * VN + i;
      marker.position.copy(hit.point);
      marker.visible = true;
      if (k !== lastK) {
        lastK = k;
        setReading(readAt(field, k, layerRef.current));
      }
    };
    const onLeave = () => {
      marker.visible = false;
      lastK = -1;
      setReading(null);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    let idleTimer = 0;
    const onStart = () => {
      controls.autoRotate = false;
      window.clearTimeout(idleTimer);
      setTouched(true);
    };
    const onEnd = () => {
      window.clearTimeout(idleTimer);
      if (!reduce) idleTimer = window.setTimeout(() => (controls.autoRotate = true), 5000);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Pull back on narrow screens so the whole tile stays in view.
      camera.zoom = Math.min(1, w / h / 1.3);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(host);

    const target = new THREE.Vector3();
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      clock += dt;

      // Colour sweep.
      let sweepX: number | null = null;
      if (sweep) {
        const p = (clock - sweep.start - LEAD) / SWEEP;
        const edge = lerp(-0.08, 1.08, clamp(p));
        const arr = colorAttr.array as Float32Array;
        for (let j = 0; j < VN; j++) {
          for (let i = 0; i < VN; i++) {
            const m = 1 - smooth(edge - 0.035, edge + 0.035, i / N);
            const k = (j * VN + i) * 3;
            arr[k] = lerp(sweep.from[k], sweep.to[k], m);
            arr[k + 1] = lerp(sweep.from[k + 1], sweep.to[k + 1], m);
            arr[k + 2] = lerp(sweep.from[k + 2], sweep.to[k + 2], m);
          }
        }
        colorAttr.needsUpdate = true;
        if (p >= 1) sweep = null;
        else if (p > 0) sweepX = (clamp(edge) - 0.5) * SIZE;
        else sweepX = -SIZE / 2;
      }

      // Bands pulling apart.
      explode += (explodeTarget - explode) * (1 - Math.exp(-dt * (reduce ? 60 : 4)));
      bandPlanes.forEach((m, i) => {
        const order = BANDS.length - 1 - i;
        m.visible = explode > 0.01;
        m.position.y = HEIGHT + 0.25 + (0.35 + order * 0.85) * explode;
        (m.material as THREE.MeshBasicMaterial).opacity = 0.88 * explode;
        ((m.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = explode;
      });
      controls.target.y += (lerp(0.6, 2.1, explode) - controls.target.y) * (1 - Math.exp(-dt * 4));
      // Step back while the bands are apart so the whole stack stays in frame.
      offset.subVectors(camera.position, controls.target).setLength(baseDistance * lerp(1, 1.15, explode));
      camera.position.copy(controls.target).add(offset);

      // Satellite: a slow circle when idle, over the scan line during a sweep.
      const satY = lerp(5.6, 7.6, explode);
      if (sweepX !== null) {
        target.set(sweepX, satY, 0);
        sat.rotation.y += (0 - sat.rotation.y) * (1 - Math.exp(-dt * 5));
      } else {
        const a = reduce ? 0.8 : clock * 0.22;
        target.set(Math.cos(a) * 4.6, satY + Math.sin(clock * 1.3) * 0.12, Math.sin(a) * 4.6);
        sat.rotation.y = -a;
      }
      sat.position.lerp(target, 1 - Math.exp(-dt * (sweepX !== null ? 9 : 3)));

      // Beam and scan line follow the sweep.
      beam.visible = scan.visible = sweepX !== null && sweep !== null && clock - sweep.start > LEAD;
      if (beam.visible && sweepX !== null) {
        const bp = beamGeo.getAttribute("position") as THREE.BufferAttribute;
        const sp = scanGeo.getAttribute("position") as THREE.BufferAttribute;
        const col = Math.round(clamp(sweepX / SIZE + 0.5) * N);
        bp.setXYZ(0, sat.position.x, sat.position.y - 0.3, sat.position.z);
        bp.setXYZ(1, sweepX, field.elev[col] * HEIGHT, -SIZE / 2);
        bp.setXYZ(2, sweepX, field.elev[N * VN + col] * HEIGHT, SIZE / 2);
        bp.needsUpdate = true;
        beamGeo.computeBoundingSphere();
        for (let j = 0; j < VN; j++) {
          sp.setXYZ(j, sweepX, field.elev[j * VN + col] * HEIGHT + 0.02, (j / N - 0.5) * SIZE);
        }
        sp.needsUpdate = true;
        scanGeo.computeBoundingSphere();
      }

      ring.scale.setScalar(1 + 0.15 * Math.sin(clock * 5));
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m: THREE.Material & { map?: THREE.Texture | null }) => {
            m.map?.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  const chooseLayer = (l: Layer) => {
    if (l === layer) return;
    setLayer(l);
    layerRef.current = l;
    api.current?.setLayer(l);
    api.current?.refresh();
  };

  const toggleBands = () => {
    const next = !exploded;
    setExploded(next);
    api.current?.setExploded(next);
  };

  const info = LAYERS.find((l) => l.id === layer)!;

  return (
    <figure className="t3d" aria-label="Interactive 3D model of a tile of land and its analysis layers">
      <div className="t3d-stage">
        <div ref={hostRef} className="t3d-canvas" />
        {failed && <p className="t3d-fallback">This 3D view needs WebGL, which this browser has turned off.</p>}

        <div className={`t3d-readout${reading ? " is-on" : ""}`} aria-live="polite">
          {reading ? (
            <>
              <span>{reading.title}</span>
              <strong>{reading.value}</strong>
              <small>{reading.detail}</small>
            </>
          ) : (
            <span>Point at the land to read it</span>
          )}
        </div>

        {exploded && (
          <ol className="t3d-bands" aria-label="Bands, top to bottom">
            {BANDS.map((b) => (
              <li key={b.id}>
                <i style={{ background: b.tint }} />
                <code>{b.id}</code> {b.name}
              </li>
            ))}
          </ol>
        )}

        {!touched && !failed && <span className="t3d-hint">Drag to turn</span>}
      </div>

      <div className="t3d-controls">
        <div className="t3d-layers" role="group" aria-label="Analysis layer">
          {LAYERS.map((l) => (
            <button key={l.id} type="button" aria-pressed={layer === l.id} onClick={() => chooseLayer(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <button type="button" className="t3d-split" aria-pressed={exploded} onClick={toggleBands}>
          {exploded ? "Put the bands back" : "Pull apart the bands"}
        </button>
      </div>

      <figcaption>
        <span>{info.formula}</span>
        {info.legend && (
          <span className={`t3d-legend t3d-legend-${layer}`}>
            <small>{info.legend[0]}</small>
            <i />
            <small>{info.legend[2]}</small>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
