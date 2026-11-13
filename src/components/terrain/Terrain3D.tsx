import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import "./terrain3d.css";

/**
 * An interactive 3D tile of land, the kind of area GEE-Assist downloads: mountains
 * with snow, a river and a lake, forest, a town with roads and a bridge, and clouds
 * drifting over it. The visitor turns it by dragging, points at it to read values,
 * switches the analysis layer (a satellite flies over and re-images the ground as it
 * changes), masks the clouds, and can pull the tile apart into its spectral bands.
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
    legend: ["0 °C", "LST", "46 °C"],
  },
  {
    id: "change",
    label: "Land cover change",
    formula: "2019 compared with 2024: red cleared, amber newly built, green regrown.",
  },
];

const BANDS = [
  { id: "B2", name: "Blue", nm: 490, tint: "#4d8df7" },
  { id: "B3", name: "Green", nm: 560, tint: "#45c46a" },
  { id: "B4", name: "Red", nm: 665, tint: "#ef5350" },
  { id: "B8", name: "Near-infrared", nm: 842, tint: "#c17cf2" },
];

/** Where each band settles when pulled apart: a 2 x 2 grid above the tile, so none hides another. */
const BAND_GRID: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
const BAND_SCALE = 0.47;

const N = 192;
const VN = N + 1;
const SIZE = 10;
const HEIGHT = 1.7;
const BASE = -0.75;
const WATER_E = 0.075;
const WATER_Y = WATER_E * HEIGHT;

/** Water's colour in each layer, since the water surface sits above the coloured ground. */
const WATER_TINT: Record<Layer, string> = {
  true: "#2a6f9a",
  ndvi: "#3d5a80",
  water: "#1f8ff0",
  lst: "#4f8fd0",
  change: "#5d6f7a",
};

/* ---------- noise and helpers ---------- */

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

/** Sharp-crested noise for mountain ridges. */
function ridged(x: number, y: number) {
  let t = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    const n = 1 - Math.abs(noise(x * f, y * f) * 2 - 1);
    t += a * n * n;
    f *= 2.1;
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

/** A small seeded random generator, so trees and buildings land in the same places every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ---------- the land ---------- */

const Change = { None: 0, Cleared: 1, Built: 2, Regrown: 3 } as const;

interface Field {
  elev: Float32Array;
  veg: Float32Array;
  temp: Float32Array;
  snow: Float32Array;
  water: Uint8Array;
  urban: Uint8Array;
  road: Uint8Array;
  change: Uint8Array;
  maxY: number;
}

const riverV = (u: number) => 0.64 + 0.09 * Math.sin(u * 6.3 + 0.5) + 0.035 * Math.sin(u * 17);
const northRoadU = (v: number) => 0.45 + 0.025 * Math.sin(v * 11);
const eastRoadV = (u: number) => 0.865 + 0.03 * Math.sin(u * 9);
const CITY = { u: 0.33, v: 0.84 };

function makeField(): Field {
  const n = VN * VN;
  const f: Field = {
    elev: new Float32Array(n),
    veg: new Float32Array(n),
    temp: new Float32Array(n),
    snow: new Float32Array(n),
    water: new Uint8Array(n),
    urban: new Uint8Array(n),
    road: new Uint8Array(n),
    change: new Uint8Array(n),
    maxY: 0,
  };
  for (let j = 0; j < VN; j++) {
    for (let i = 0; i < VN; i++) {
      const u = i / N;
      const v = j / N;
      const k = j * VN + i;

      // Rolling ground, with a ridged range of mountains along the north edge.
      let e = fbm(u * 3 + 1.3, v * 3 + 0.7) * 0.72;
      e += smooth(0.6, 0.0, v) * 0.78 * ridged(u * 3.4 + 7, v * 3.4 + 2);
      e += 0.025 * (noise(u * 70, v * 70) - 0.5);

      // The river valley and its bed.
      const d = Math.abs(v - riverV(u));
      e = lerp(0.1, e, smooth(0.02, 0.17, d));
      if (d < 0.03) e = Math.min(e, lerp(0.02, 0.1, smooth(0.0, 0.03, d)));

      // The lake basin.
      const ld = Math.hypot(u - 0.8, (v - 0.33) * 1.2);
      e = lerp(0.1, e, smooth(0.07, 0.15, ld));
      if (ld < 0.09) e = Math.min(e, lerp(0.02, 0.1, smooth(0.05, 0.09, ld)));

      // The town sits on flattened ground.
      const cd = Math.hypot(u - CITY.u, (v - CITY.v) * 1.1);
      const ring = 0.02 * Math.sin(Math.atan2(v - CITY.v, u - CITY.u) * 5);
      if (cd < 0.16) e = lerp(e, 0.15, 0.75 * smooth(0.16, 0.08, cd));

      const water = d < 0.02 || ld < 0.072;
      const urbanNow = !water && cd < 0.125 + ring;
      const urbanThen = !water && cd < 0.085 + ring;
      const road =
        !water &&
        ((u > CITY.u && Math.abs(v - eastRoadV(u)) < 0.0065) ||
          (v > 0.3 && v < CITY.v && Math.abs(u - northRoadU(v)) < 0.0065));

      const snow = smooth(1.0, 1.12, e + 0.08 * (noise(u * 25, v * 25) - 0.5));

      let veg = clamp(0.1 + 1.0 * (fbm(u * 5 + 11, v * 5 + 3) - 0.2));
      veg = clamp(veg + 0.3 * smooth(0.1, 0.03, d) - Math.max(0, e - 0.72) * 1.4, 0, 0.92);
      veg *= 1 - snow;

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
      if (road) veg = Math.min(veg, 0.05);
      if (water) veg = -0.1;

      let temp = water
        ? 19 + 1.5 * noise(u * 9, v * 9)
        : 23 + 17 * (1 - clamp(veg)) - e * 9 + (urbanNow ? 7 : 0) + 2 * noise(u * 12, v * 12);
      temp = lerp(temp, 1.5, snow);

      f.elev[k] = e;
      f.veg[k] = veg;
      f.snow[k] = snow;
      f.water[k] = water ? 1 : 0;
      f.urban[k] = urbanNow ? 1 : 0;
      f.road[k] = road ? 1 : 0;
      f.change[k] = change;
      f.temp[k] = temp;
      f.maxY = Math.max(f.maxY, e * HEIGHT);
    }
  }
  return f;
}

/** Ground height at any point of the tile, interpolated between grid points. */
function heightAt(f: Field, u: number, v: number) {
  const x = clamp(u) * N;
  const y = clamp(v) * N;
  const i = Math.min(N - 1, Math.floor(x));
  const j = Math.min(N - 1, Math.floor(y));
  const fx = x - i;
  const fy = y - j;
  const e = (a: number, b: number) => f.elev[b * VN + a];
  return lerp(lerp(e(i, j), e(i + 1, j), fx), lerp(e(i, j + 1), e(i + 1, j + 1), fx), fy) * HEIGHT;
}

const indexAt = (u: number, v: number) => Math.round(clamp(v) * N) * VN + Math.round(clamp(u) * N);

/** Surface reflectance of each Sentinel-2 band at one point: [B2, B3, B4, B8]. */
function reflectance(f: Field, k: number): [number, number, number, number] {
  if (f.water[k]) return [0.07, 0.06, 0.035, 0.012];
  if (f.road[k]) return [0.11, 0.11, 0.12, 0.15];
  if (f.urban[k]) return [0.14, 0.16, 0.18, 0.22];
  const g = clamp(f.veg[k]);
  const rock = smooth(0.78, 1.0, f.elev[k]);
  const soil = [0.1, 0.14, 0.2, 0.27];
  const plant = [0.035, 0.08, 0.04, 0.46];
  const stone = [0.2, 0.21, 0.22, 0.26];
  const snowy = [0.78, 0.77, 0.75, 0.64];
  return soil.map((s, b) => lerp(lerp(lerp(s, plant[b], g), stone[b], rock), snowy[b], f.snow[k])) as [
    number,
    number,
    number,
    number,
  ];
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
  [0, "#283f8f"],
  [15, "#4f8fd0"],
  [25, "#9fd3d8"],
  [32, "#f2d06b"],
  [39, "#e8743a"],
  [46, "#b8232b"],
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
      if (f.water[k]) {
        // The bed under the water surface: sandy where shallow.
        c.set("#7f7350");
      } else {
        const [b, g, r] = reflectance(f, k);
        const gain = 3.4;
        c.setRGB(clamp(r * gain), clamp(g * gain), clamp(b * gain), THREE.SRGBColorSpace);
      }
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
  if (f.road[k]) return "Road";
  if (f.urban[k]) return "Built-up";
  if (f.snow[k] > 0.5) return "Snow";
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
  where: string;
}

function readAt(f: Field, k: number, layer: Layer): Reading {
  const i = k % VN;
  const j = Math.floor(k / VN);
  const where = `${((i / N) * 10).toFixed(1)} km E · ${((1 - j / N) * 10).toFixed(1)} km N`;
  const elevation = `${Math.round(240 + f.elev[k] * 1100)} m`;
  const cls = landClass(f, k);
  switch (layer) {
    case "ndvi":
      return { title: "NDVI", value: ndviAt(f, k).toFixed(2), detail: `${cls} · ${elevation}`, where };
    case "water": {
      const w = ndwiAt(f, k);
      return { title: "NDWI", value: w.toFixed(2), detail: w > 0 ? "Open water" : `Land · ${elevation}`, where };
    }
    case "lst":
      return { title: "Surface temperature", value: `${f.temp[k].toFixed(1)} °C`, detail: `${cls} · ${elevation}`, where };
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
      return { title: "2019 → 2024", value, detail: cls, where };
    }
    default:
      return { title: "Land cover", value: cls, detail: `Elevation ${elevation}`, where };
  }
}

function readBand(f: Field, k: number, band: number): Reading {
  const b = BANDS[band];
  const r = reflectance(f, k)[band];
  const i = k % VN;
  const j = Math.floor(k / VN);
  return {
    title: `${b.id} · ${b.name}, ${b.nm} nm`,
    value: `${(r * 100).toFixed(1)} %`,
    detail: `of the light reflected · ${landClass(f, k)}`,
    where: `${((i / N) * 10).toFixed(1)} km E · ${((1 - j / N) * 10).toFixed(1)} km N`,
  };
}

/* ---------- textures ---------- */

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Horizontal rock strata for the sides of the block. */
function strataTexture() {
  const tex = canvasTexture(256, 256, (ctx) => {
    const img = ctx.createImageData(256, 256);
    const layers = ["#8f7556", "#a5865f", "#74593f", "#b59a72", "#7e6c5c", "#5f4c3c", "#968474", "#6d5a48", "#55463b"];
    const pick = (y: number) => new THREE.Color(layers[Math.floor(y) % layers.length]);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const wobble = 5 * Math.sin(x * 0.045 + y * 0.01) + 4 * noise(x * 0.05, y * 0.02);
        const band = (y + wobble) / 22;
        const c = pick(band).lerp(pick(band + 1), smooth(0.85, 1, band % 1));
        const grain = 0.86 + 0.24 * hash(x, y);
        const deep = lerp(1, 0.7, y / 255);
        const p = (y * 256 + x) * 4;
        img.data[p] = clamp(c.r * grain * deep) * 255;
        img.data[p + 1] = clamp(c.g * grain * deep) * 255;
        img.data[p + 2] = clamp(c.b * grain * deep) * 255;
        img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Pebbles.
    for (let i = 0; i < 260; i++) {
      const x = hash(i, 1) * 256;
      const y = 60 + hash(i, 2) * 196;
      ctx.fillStyle = `rgba(${hash(i, 3) > 0.5 ? "40,32,26" : "200,186,160"},0.55)`;
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + hash(i, 4) * 2.5, 0.8 + hash(i, 5) * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** A tiling normal map of small waves for the water surface. */
function waveNormalTexture() {
  const S = 128;
  const h = (x: number, y: number) =>
    noise((x / S) * 8, (y / S) * 8) * 0.6 + noise((x / S) * 16 + 3, (y / S) * 16) * 0.4;
  const tex = canvasTexture(
    S,
    S,
    (ctx) => {
      const img = ctx.createImageData(S, S);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const dx = h((x + 1) % S, y) - h((x - 1 + S) % S, y);
          const dy = h(x, (y + 1) % S) - h(x, (y - 1 + S) % S);
          const nv = new THREE.Vector3(-dx * 6, -dy * 6, 1).normalize();
          const p = (y * S + x) * 4;
          img.data[p] = (nv.x * 0.5 + 0.5) * 255;
          img.data[p + 1] = (nv.y * 0.5 + 0.5) * 255;
          img.data[p + 2] = (nv.z * 0.5 + 0.5) * 255;
          img.data[p + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    false,
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function solarCellTexture() {
  return canvasTexture(128, 48, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 48);
    g.addColorStop(0, "#1b3a6e");
    g.addColorStop(0.5, "#2c5b9e");
    g.addColorStop(1, "#173362");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 48);
    ctx.strokeStyle = "rgba(190,215,240,0.55)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= 128; x += 10.6) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 48);
      ctx.stroke();
    }
    for (let y = 0; y <= 48; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#c9d3da";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 125, 45);
  });
}

function shadowTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.6, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/**
 * One band as an image: brightness is reflectance, stretched between the band's own
 * darkest and brightest values so its detail is readable, and lightly tinted with the
 * band's colour so the four can be told apart.
 */
function bandTexture(f: Field, band: number, tint: string) {
  const values = new Float32Array(VN * VN);
  for (let k = 0; k < VN * VN; k++) values[k] = reflectance(f, k)[band];
  const sorted = Float32Array.from(values).sort();
  const lo = sorted[Math.floor(sorted.length * 0.01)];
  const hi = sorted[Math.floor(sorted.length * 0.99)];
  const t = new THREE.Color(tint);
  return canvasTexture(VN, VN, (ctx) => {
    const img = ctx.createImageData(VN, VN);
    for (let k = 0; k < VN * VN; k++) {
      const v = 0.06 + 0.94 * clamp((values[k] - lo) / (hi - lo || 1)) ** 0.85;
      img.data[k * 4] = clamp(v * lerp(1, t.r * 1.25, 0.45)) * 255;
      img.data[k * 4 + 1] = clamp(v * lerp(1, t.g * 1.25, 0.45)) * 255;
      img.data[k * 4 + 2] = clamp(v * lerp(1, t.b * 1.25, 0.45)) * 255;
      img.data[k * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** A floating label for a band: its name, colour and wavelength. */
function bandLabel(b: (typeof BANDS)[number]) {
  const tex = canvasTexture(640, 112, (ctx) => {
    ctx.fillStyle = "rgba(12, 28, 30, 0.88)";
    ctx.beginPath();
    ctx.roundRect(4, 4, 632, 104, 52);
    ctx.fill();
    ctx.strokeStyle = b.tint;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = b.tint;
    ctx.beginPath();
    ctx.arc(56, 56, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 46px 'IBM Plex Sans', system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(b.id, 92, 58);
    ctx.fillStyle = "#cfe5e0";
    ctx.font = "500 40px 'IBM Plex Sans', system-ui, sans-serif";
    ctx.fillText(`${b.name} · ${b.nm} nm`, 170, 58);
  });
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, toneMapped: false }),
  );
  sprite.scale.set(3.8, 0.665, 1);
  sprite.renderOrder = 10;
  return sprite;
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

/** The four sides of the block, cut through rock strata, so the tile reads as a solid slice of ground. */
function skirtGeometry(f: Field) {
  const edges: number[][] = [
    Array.from({ length: VN }, (_, i) => i),
    Array.from({ length: VN }, (_, i) => N * VN + i),
    Array.from({ length: VN }, (_, j) => j * VN),
    Array.from({ length: VN }, (_, j) => j * VN + N),
  ];
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const top = 2.6;
  const water = new THREE.Color("#7fb4d8");
  for (const edge of edges) {
    const start = pos.length / 3;
    edge.forEach((k, s) => {
      const i = k % VN;
      const j = Math.floor(k / VN);
      const x = (i / N - 0.5) * SIZE;
      const z = (j / N - 0.5) * SIZE;
      const y = f.water[k] ? Math.max(WATER_Y, f.elev[k] * HEIGHT) : f.elev[k] * HEIGHT;
      const along = (s / N) * 3;
      pos.push(x, y, z, x, BASE, z);
      uv.push(along, (y - BASE) / (top - BASE), along, 0);
      const t = f.water[k] ? water : new THREE.Color(1, 1, 1);
      col.push(t.r, t.g, t.b, 0.55, 0.55, 0.55);
    });
    for (let s = 0; s < edge.length - 1; s++) {
      const a = start + s * 2;
      const b = a + 2;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function paint(geo: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color);
  const n = geo.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo.index ? geo.toNonIndexed() : geo;
}

function trunk() {
  return paint(new THREE.CylinderGeometry(0.012, 0.018, 0.07, 5).translate(0, 0.035, 0), "#6b5038");
}

function conifer() {
  return mergeGeometries([
    trunk(),
    paint(new THREE.ConeGeometry(0.075, 0.17, 7).translate(0, 0.13, 0), "#ffffff"),
    paint(new THREE.ConeGeometry(0.055, 0.14, 7).translate(0, 0.21, 0), "#f2f2f2"),
  ])!;
}

function broadleaf() {
  return mergeGeometries([
    trunk(),
    paint(new THREE.IcosahedronGeometry(0.075, 0).scale(1, 0.85, 1).translate(0, 0.13, 0), "#ffffff"),
  ])!;
}

/** An instanced group that is recoloured with the layers, like the ground under it. */
interface Painted {
  mesh: THREE.InstancedMesh;
  u: Float32Array;
  colors: Record<Layer, Float32Array>;
}

function paintedInstances(
  geo: THREE.BufferGeometry,
  items: { u: number; v: number; m: THREE.Matrix4; own: THREE.Color }[],
  layerArrays: Record<Layer, Float32Array>,
  f: Field,
  shade: number,
): Painted {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const u = new Float32Array(items.length);
  const colors = {} as Record<Layer, Float32Array>;
  const c = new THREE.Color();
  (Object.keys(layerArrays) as Layer[]).forEach((l) => {
    const arr = new Float32Array(items.length * 3);
    items.forEach((it, n) => {
      if (l === "true") c.copy(it.own);
      else {
        const k = indexAt(it.u, it.v) * 3;
        c.setRGB(layerArrays[l][k], layerArrays[l][k + 1], layerArrays[l][k + 2]).multiplyScalar(shade);
        if (l === "change" && f.change[indexAt(it.u, it.v)] === Change.None) c.lerp(it.own, 0.15);
      }
      arr[n * 3] = c.r;
      arr[n * 3 + 1] = c.g;
      arr[n * 3 + 2] = c.b;
    });
    colors[l] = arr;
  });
  items.forEach((it, n) => {
    mesh.setMatrixAt(n, it.m);
    u[n] = it.u;
    mesh.setColorAt(n, c.setRGB(colors.true[n * 3], colors.true[n * 3 + 1], colors.true[n * 3 + 2]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh, u, colors };
}

function placeTrees(f: Field, layerArrays: Record<Layer, Float32Array>) {
  const rand = rng(7);
  const pines: Parameters<typeof paintedInstances>[1] = [];
  const leafy: Parameters<typeof paintedInstances>[1] = [];
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const STEP = 1 / 78;
  for (let a = STEP / 2; a < 1; a += STEP) {
    for (let b = STEP / 2; b < 1; b += STEP) {
      const u = a + (rand() - 0.5) * STEP;
      const v = b + (rand() - 0.5) * STEP;
      const k = indexAt(u, v);
      if (f.water[k] || f.urban[k] || f.road[k] || f.snow[k] > 0.15 || f.elev[k] > 0.98) continue;
      const g = f.veg[k];
      if (g < 0.55 || rand() > (g - 0.5) * 2.2) continue;
      if (u < 0.015 || u > 0.985 || v < 0.015 || v > 0.985) continue;
      const young = f.change[k] === Change.Regrown;
      const s = (young ? 0.55 : 0.8) + rand() * 0.45;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3((u - 0.5) * SIZE, heightAt(f, u, v) - 0.01, (v - 0.5) * SIZE),
        q.setFromAxisAngle(up, rand() * Math.PI * 2),
        new THREE.Vector3(s, s * (0.85 + rand() * 0.4), s),
      );
      const hsl = { h: 0, s: 0, l: 0 };
      const high = f.elev[k] > 0.55;
      const own = new THREE.Color(high ? "#2d5631" : "#4d7d33");
      own.getHSL(hsl);
      own.setHSL(hsl.h + (rand() - 0.5) * 0.04, hsl.s, hsl.l * (0.8 + rand() * 0.4));
      (high || rand() < 0.25 ? pines : leafy).push({ u, v, m, own });
    }
  }
  return [paintedInstances(conifer(), pines, layerArrays, f, 0.82), paintedInstances(broadleaf(), leafy, layerArrays, f, 0.82)];
}

function placeBuildings(f: Field, layerArrays: Record<Layer, Float32Array>) {
  const rand = rng(21);
  const items: Parameters<typeof paintedInstances>[1] = [];
  const roofs = ["#c9c2b8", "#b5aea3", "#a35d48", "#8e8a85", "#d8d2c6", "#b9775a", "#9aa3a8"];
  const angle = 0.28;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  const STEP = 0.0125;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  for (let a = -0.16; a < 0.16; a += STEP) {
    for (let b = -0.16; b < 0.16; b += STEP) {
      // A street grid turned slightly off north.
      const u = CITY.u + a * ca - b * sa + (rand() - 0.5) * 0.002;
      const v = CITY.v + a * sa + b * ca + (rand() - 0.5) * 0.002;
      const k = indexAt(u, v);
      if (!f.urban[k] || f.road[k] || rand() < 0.18) continue;
      if (Math.abs(Math.round(a / STEP)) % 4 === 0) continue; // streets
      const centre = 1 - clamp(Math.hypot(u - CITY.u, v - CITY.v) / 0.13);
      const h = 0.04 + rand() * 0.08 + centre * centre * rand() * 0.42;
      const w = 0.055 + rand() * 0.035;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3((u - 0.5) * SIZE, heightAt(f, u, v) + h / 2 - 0.01, (v - 0.5) * SIZE),
        q,
        new THREE.Vector3(w, h, w * (0.8 + rand() * 0.5)),
      );
      items.push({ u, v, m, own: new THREE.Color(roofs[Math.floor(rand() * roofs.length)]) });
    }
  }
  return paintedInstances(paint(new THREE.BoxGeometry(1, 1, 1), "#ffffff"), items, layerArrays, f, 1);
}

/** Where the north road crosses the river. */
function bridgeSpot() {
  let v = 0.64;
  let u = northRoadU(v);
  for (let i = 0; i < 6; i++) {
    v = riverV(u);
    u = northRoadU(v);
  }
  return { u, v };
}

function makeBridge() {
  const { u, v } = bridgeSpot();
  const g = new THREE.Group();
  const deck = new THREE.MeshStandardMaterial({ color: "#b9b4aa", roughness: 0.7 });
  const rail = new THREE.MeshStandardMaterial({ color: "#e4e0d8", roughness: 0.5, metalness: 0.2 });
  const span = 0.62;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, span), deck));
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, span), rail);
    r.position.set(side * 0.06, 0.03, 0);
    g.add(r);
  }
  for (const end of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.05), deck);
    pier.position.set(0, -0.09, end * 0.1);
    g.add(pier);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  g.position.set((u - 0.5) * SIZE, 0.1 * HEIGHT + 0.03, (v - 0.5) * SIZE);
  // Line the deck up with the road's direction.
  const du = northRoadU(v + 0.01) - northRoadU(v - 0.01);
  g.rotation.y = -Math.atan2(du, 0.02);
  return g;
}

function makeCloud(seed: number) {
  const rand = rng(seed);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 1,
    transparent: true,
    opacity: 0.94,
    flatShading: true,
    depthWrite: false,
  });
  const puffs = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < puffs; i++) {
    const r = 0.28 + rand() * 0.32;
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    p.position.set((i - puffs / 2) * 0.3 + rand() * 0.15, rand() * 0.18 + (i % 2) * 0.08, (rand() - 0.5) * 0.5);
    p.scale.y = 0.72;
    p.castShadow = true;
    g.add(p);
  }
  return { group: g, mat };
}

function makeSatellite() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: "#d9ad4f", metalness: 0.85, roughness: 0.32 });
  const silver = new THREE.MeshStandardMaterial({ color: "#c9d1d6", metalness: 0.9, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: "#1b2226", metalness: 0.5, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: "#2d6fa8", emissive: "#5ed3a8", emissiveIntensity: 0.6, roughness: 0.1 });
  const cells = new THREE.MeshStandardMaterial({ map: solarCellTexture(), metalness: 0.4, roughness: 0.35 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.42), gold);
  g.add(body);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), silver);
  deck.position.y = 0.28;
  g.add(deck);

  const wings = new THREE.Group();
  for (const side of [-1, 1]) {
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), silver);
    boom.rotation.z = Math.PI / 2;
    boom.position.x = side * 0.38;
    wings.add(boom);
    for (let p = 0; p < 2; p++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.4), [silver, silver, cells, cells, silver, silver]);
      panel.position.x = side * (0.86 + p * 0.65);
      wings.add(panel);
    }
  }
  g.add(wings);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.16, 24), dark);
  lens.position.y = -0.34;
  g.add(lens);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), glass);
  eye.rotation.x = Math.PI / 2;
  eye.position.y = -0.425;
  g.add(eye);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), silver);
  mast.position.set(0.12, 0.42, 0.1);
  g.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), silver);
  dish.material = silver.clone();
  (dish.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  dish.position.set(0.12, 0.42, 0.1);
  dish.rotation.x = -0.5;
  g.add(dish);

  const tracker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), dark);
  tracker.position.set(-0.14, 0.34, -0.12);
  g.add(tracker);

  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 8),
    new THREE.MeshBasicMaterial({ color: "#ff5a4f" }),
  );
  light.position.set(-0.2, 0.3, 0.2);
  g.add(light);

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  g.scale.setScalar(0.8);
  return { group: g, wings, light };
}

/* ---------- component ---------- */

interface Api {
  setLayer: (l: Layer) => void;
  setExploded: (b: boolean) => void;
  setClouds: (b: boolean) => void;
  /** Re-read the point under the pointer after the layer changes. */
  refresh: () => void;
}

export default function Terrain3D() {
  const hostRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [layer, setLayer] = useState<Layer>("true");
  const [exploded, setExploded] = useState(false);
  const [clouds, setClouds] = useState(true);
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
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.35;

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

    scene.add(new THREE.HemisphereLight("#dfefff", "#3a2e22", 0.85));
    const sun = new THREE.DirectionalLight("#fff1da", 2.6);
    sun.position.set(-7, 11, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
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
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);

    const skirt = new THREE.Mesh(
      skirtGeometry(field),
      new THREE.MeshStandardMaterial({ map: strataTexture(), vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    );
    skirt.receiveShadow = true;
    scene.add(skirt);

    // Plinth, kilometre ticks and a soft shadow under the block.
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(SIZE + 0.5, 0.22, SIZE + 0.5),
      new THREE.MeshStandardMaterial({ color: "#1d2b2c", roughness: 0.45, metalness: 0.3 }),
    );
    plinth.position.y = BASE - 0.11;
    plinth.receiveShadow = true;
    scene.add(plinth);
    const tickMat = new THREE.MeshBasicMaterial({ color: "#cfe5e0" });
    const tickGeo = new THREE.BoxGeometry(0.025, 0.006, 0.12);
    for (let s = 0; s <= 10; s++) {
      const p = (s / 10 - 0.5) * SIZE;
      const len = s % 5 === 0 ? 1.7 : 1;
      for (const [x, z, rot] of [
        [p, SIZE / 2 + 0.13, 0],
        [p, -SIZE / 2 - 0.13, 0],
        [SIZE / 2 + 0.13, p, Math.PI / 2],
        [-SIZE / 2 - 0.13, p, Math.PI / 2],
      ] as const) {
        const t = new THREE.Mesh(tickGeo, tickMat);
        t.position.set(x, BASE + 0.003, z);
        t.rotation.y = rot;
        t.scale.z = len;
        scene.add(t);
      }
    }
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(SIZE * 1.9, SIZE * 1.9),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = BASE - 0.24;
    scene.add(ground);

    // The river and lake surface.
    const waves = waveNormalTexture();
    const waterMat = new THREE.MeshStandardMaterial({
      color: WATER_TINT.true,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.84,
      normalMap: waves,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });
    const waterSurface = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), waterMat);
    waterSurface.rotation.x = -Math.PI / 2;
    waterSurface.position.y = WATER_Y;
    waterSurface.receiveShadow = true;
    scene.add(waterSurface);
    const waterFrom = new THREE.Color(WATER_TINT.true);
    const waterTo = new THREE.Color(WATER_TINT.true);

    // Trees, buildings and the bridge.
    const painted: Painted[] = [...placeTrees(field, colors), placeBuildings(field, colors)];
    painted.forEach((p) => scene.add(p.mesh));
    scene.add(makeBridge());

    // Bands: lifted off the tile and spread into a grid when pulled apart.
    const bandPlanes = BANDS.map((b, i) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(SIZE, SIZE),
        new THREE.MeshBasicMaterial({
          map: bandTexture(field, i, b.tint),
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(m.geometry),
        new THREE.LineBasicMaterial({ color: b.tint, transparent: true, opacity: 0, toneMapped: false }),
      );
      m.add(edge);
      return m;
    });
    const bandLabels = BANDS.map((b) => {
      const l = bandLabel(b);
      l.visible = false;
      scene.add(l);
      return l;
    });
    let hoverBand = -1;
    let tiltUntil = -1;
    let tiltPhi = 1.0;
    const sph = new THREE.Spherical();

    // Clouds.
    const cloudRand = rng(3);
    const cloudSet = Array.from({ length: 5 }, (_, i) => {
      const c = makeCloud(40 + i * 7);
      c.group.position.set(-7 + i * 3.1 + cloudRand(), field.maxY + 0.9 + cloudRand() * 0.8, (cloudRand() - 0.5) * 8);
      c.group.scale.setScalar(0.6 + cloudRand() * 0.35);
      scene.add(c.group);
      return { ...c, base: c.group.scale.x };
    });
    let cloudShow = 1;
    let cloudTarget = 1;

    // Satellite and its orbit.
    const sat = makeSatellite();
    sat.group.position.set(4.6, 5.6, 0);
    scene.add(sat.group);
    const orbitPts = Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6);
    });
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineDashedMaterial({ color: "#cfe5e0", dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.35 }),
    );
    orbit.computeLineDistances();
    scene.add(orbit);

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
    let sweep: {
      from: Float32Array;
      to: Float32Array;
      inst: { from: Float32Array; to: Float32Array }[];
      start: number;
    } | null = null;
    const SWEEP = reduce ? 0.001 : 1.7;
    const LEAD = reduce ? 0 : 0.45;
    let explode = 0;
    let explodeTarget = 0;
    let clock = 0;

    let lastK = -1;
    api.current = {
      setLayer(l) {
        sweep = {
          from: Float32Array.from(colorAttr.array as Float32Array),
          to: colors[l],
          inst: painted.map((p) => ({ from: Float32Array.from(p.mesh.instanceColor!.array as Float32Array), to: p.colors[l] })),
          start: clock,
        };
        waterFrom.copy(waterMat.color);
        waterTo.set(WATER_TINT[l]);
      },
      setExploded(b) {
        explodeTarget = b ? 1 : 0;
        // Look down at the spread bands; tilt back to the usual view when they go back.
        tiltPhi = b ? 0.6 : 1.0;
        tiltUntil = clock + 1.6;
        // What was under the pointer has moved away; clear the reading.
        hoverBand = -1;
        lastK = -1;
        marker.visible = false;
        setReading(null);
      },
      setClouds(b) {
        cloudTarget = b ? 1 : 0;
      },
      refresh() {
        if (lastK >= 0 && hoverBand < 0) setReading(readAt(field, lastK, layerRef.current));
      },
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      // When the bands are apart, read the band under the pointer.
      if (explode > 0.6) {
        const bh = raycaster.intersectObjects(bandPlanes, false)[0];
        if (bh?.uv) {
          const band = (bandPlanes as THREE.Object3D[]).indexOf(bh.object);
          const k = indexAt(bh.uv.x, 1 - bh.uv.y);
          marker.position.copy(bh.point);
          marker.visible = true;
          if (k !== lastK || band !== hoverBand) {
            lastK = k;
            hoverBand = band;
            setReading(readBand(field, k, band));
          }
          return;
        }
      }
      hoverBand = -1;
      const hit = raycaster.intersectObject(terrain, false)[0];
      if (!hit) {
        marker.visible = false;
        if (lastK !== -1) {
          lastK = -1;
          setReading(null);
        }
        return;
      }
      const k = indexAt(hit.point.x / SIZE + 0.5, hit.point.z / SIZE + 0.5);
      marker.position.copy(hit.point);
      if (field.water[k]) marker.position.y = WATER_Y;
      marker.visible = true;
      if (k !== lastK) {
        lastK = k;
        setReading(readAt(field, k, layerRef.current));
      }
    };
    const onLeave = () => {
      marker.visible = false;
      lastK = -1;
      hoverBand = -1;
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

      // Colour sweep over the ground, trees, buildings and water.
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
        painted.forEach((pt, n) => {
          const { from, to } = sweep!.inst[n];
          const ic = pt.mesh.instanceColor!;
          const ia = ic.array as Float32Array;
          for (let q = 0; q < pt.u.length; q++) {
            const m = 1 - smooth(edge - 0.035, edge + 0.035, pt.u[q]);
            ia[q * 3] = lerp(from[q * 3], to[q * 3], m);
            ia[q * 3 + 1] = lerp(from[q * 3 + 1], to[q * 3 + 1], m);
            ia[q * 3 + 2] = lerp(from[q * 3 + 2], to[q * 3 + 2], m);
          }
          ic.needsUpdate = true;
        });
        waterMat.color.copy(waterFrom).lerp(waterTo, clamp(edge));
        if (p >= 1) sweep = null;
        else if (p > 0) sweepX = (clamp(edge) - 0.5) * SIZE;
        else sweepX = -SIZE / 2;
      }

      // Water ripples.
      if (!reduce) {
        waves.offset.x = clock * 0.012;
        waves.offset.y = clock * 0.007;
      }

      // Bands pulling apart.
      explode += (explodeTarget - explode) * (1 - Math.exp(-dt * (reduce ? 60 : 4)));
      // First they rise off the tile as a stack, then slide apart into the grid.
      const rise = smooth(0, 0.55, explode);
      const spread = smooth(0.35, 1, explode);
      const bandY = field.maxY + 1.3;
      bandPlanes.forEach((m, i) => {
        const order = BANDS.length - 1 - i;
        const [gx, gz] = BAND_GRID[i];
        const s = lerp(1, BAND_SCALE, spread) * (i === hoverBand ? 1.03 : 1);
        m.visible = explode > 0.01;
        m.scale.set(s, s, 1);
        m.position.set(
          gx * 2.62 * spread,
          lerp(field.maxY + 0.2, bandY, rise) + order * 0.55 * rise * (1 - spread),
          gz * 2.62 * spread,
        );
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.opacity = explode;
        mat.transparent = explode < 0.99;
        const edge = (m.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial;
        edge.opacity = explode;
        edge.color.set(i === hoverBand ? "#ffffff" : BANDS[i].tint);
        const label = bandLabels[i];
        label.visible = spread > 0.5;
        label.position.set(m.position.x, m.position.y + 0.5, m.position.z - (SIZE / 2) * s - 0.1);
        (label.material as THREE.SpriteMaterial).opacity = smooth(0.5, 1, spread);
      });
      controls.target.y += (lerp(0.6, bandY - 0.4, explode) - controls.target.y) * (1 - Math.exp(-dt * 4));
      // Step back while the bands are apart so the whole grid stays in frame, and tilt to look down at it.
      offset.subVectors(camera.position, controls.target);
      sph.setFromVector3(offset);
      if (clock < tiltUntil) sph.phi += (tiltPhi - sph.phi) * (1 - Math.exp(-dt * 3.5));
      sph.radius = baseDistance * lerp(1, 1.12, explode);
      offset.setFromSpherical(sph);
      camera.position.copy(controls.target).add(offset);

      // Clouds drift east and fade at the edges; the mask (or the bands) clears them.
      cloudShow += (cloudTarget * (1 - explode) - cloudShow) * (1 - Math.exp(-dt * (reduce ? 60 : 3)));
      for (const c of cloudSet) {
        if (!reduce) {
          c.group.position.x += dt * 0.22;
          if (c.group.position.x > 7.5) c.group.position.x = -7.5;
        }
        const edgeFade = 1 - smooth(5.2, 7.4, Math.abs(c.group.position.x));
        c.mat.opacity = 0.94 * edgeFade * cloudShow;
        c.group.visible = c.mat.opacity > 0.02;
        c.group.scale.setScalar(c.base * lerp(0.6, 1, cloudShow));
      }

      // Satellite: a slow circle when idle, over the scan line during a sweep.
      const satY = lerp(5.6, 7.6, explode);
      orbit.position.y = satY;
      // Keep the satellite out of the way while the bands are laid out.
      sat.group.visible = orbit.visible = explode < 0.3;
      (orbit.material as THREE.LineDashedMaterial).opacity = 0.35 * (sweepX === null ? 1 : 0.3);
      if (sweepX !== null) {
        target.set(sweepX, satY, 0);
        sat.group.rotation.y += (0 - sat.group.rotation.y) * (1 - Math.exp(-dt * 5));
      } else {
        const a = reduce ? 0.8 : clock * 0.22;
        target.set(Math.cos(a) * 4.6, satY + Math.sin(clock * 1.3) * 0.12, Math.sin(a) * 4.6);
        sat.group.rotation.y = -a;
      }
      sat.group.position.lerp(target, 1 - Math.exp(-dt * (sweepX !== null ? 9 : 3)));
      sat.wings.rotation.x = Math.sin(clock * 0.4) * 0.35;
      sat.light.visible = Math.sin(clock * 6) > 0.6;

      // Beam and scan line follow the sweep.
      beam.visible = scan.visible = sweepX !== null && sweep !== null && clock - sweep.start > LEAD;
      if (beam.visible && sweepX !== null) {
        const bp = beamGeo.getAttribute("position") as THREE.BufferAttribute;
        const sp = scanGeo.getAttribute("position") as THREE.BufferAttribute;
        const col = Math.round(clamp(sweepX / SIZE + 0.5) * N);
        const pos = sat.group.position;
        bp.setXYZ(0, pos.x, pos.y - 0.3, pos.z);
        bp.setXYZ(1, sweepX, Math.max(WATER_Y, field.elev[col] * HEIGHT), -SIZE / 2);
        bp.setXYZ(2, sweepX, Math.max(WATER_Y, field.elev[N * VN + col] * HEIGHT), SIZE / 2);
        bp.needsUpdate = true;
        beamGeo.computeBoundingSphere();
        for (let j = 0; j < VN; j++) {
          sp.setXYZ(j, sweepX, Math.max(WATER_Y, field.elev[j * VN + col] * HEIGHT) + 0.02, (j / N - 0.5) * SIZE);
        }
        sp.needsUpdate = true;
        scanGeo.computeBoundingSphere();
      }

      ring.scale.setScalar(1 + 0.15 * Math.sin(clock * 5));
      controls.update();
      if (compassRef.current) {
        compassRef.current.style.transform = `rotate(${THREE.MathUtils.radToDeg(controls.getAzimuthalAngle())}deg)`;
      }
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
          mats.forEach((m: THREE.Material & { map?: THREE.Texture | null; normalMap?: THREE.Texture | null }) => {
            m.map?.dispose();
            m.normalMap?.dispose();
            m.dispose();
          });
        }
      });
      envTex.dispose();
      pmrem.dispose();
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

  const toggleClouds = () => {
    const next = !clouds;
    setClouds(next);
    api.current?.setClouds(next);
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
              <small className="t3d-where">{reading.where}</small>
            </>
          ) : (
            <span>{exploded ? "Point at a band to read it" : "Point at the land to read it"}</span>
          )}
        </div>

        {!failed && (
          <div className="t3d-frame" aria-hidden="true">
            <div className="t3d-compass" ref={compassRef}>
              <svg viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18.5" />
                <path className="n" d="M20 5 L24.5 20 L15.5 20 Z" />
                <path className="s" d="M20 35 L24.5 20 L15.5 20 Z" />
                <text x="20" y="4.2">
                  N
                </text>
              </svg>
            </div>
            <span>10 × 10 km</span>
          </div>
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
        <div className="t3d-toggles">
          <button type="button" className="t3d-split" aria-pressed={!clouds} onClick={toggleClouds}>
            {clouds ? "Mask clouds" : "Show clouds"}
          </button>
          <button type="button" className="t3d-split" aria-pressed={exploded} onClick={toggleBands}>
            {exploded ? "Put the bands back" : "Pull apart the bands"}
          </button>
        </div>
      </div>

      <figcaption>
        {exploded ? (
          <span>
            Each band is the light reflected in one slice of the spectrum; brighter means more. Plants are bright in{" "}
            <strong>B8</strong> and dark in <strong>B4</strong>, which is what NDVI measures. Water is dark in B8.
          </span>
        ) : (
          <span>{info.formula}</span>
        )}
        {!exploded && info.legend && (
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
