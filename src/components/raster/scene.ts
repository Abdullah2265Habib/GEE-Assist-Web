/* A made-up satellite scene for the viewer demo: a reservoir, a river, forest on the hills, crops,
   a town and some bare ground. Each pixel has reflectance in six bands, so the views are computed
   the way the desktop viewer computes them (stretches, NDVI, NDWI, Dynamic World classes). */

export const W = 128;
export const H = 84;
// The area it pretends to cover (around a reservoir in the Potohar plateau).
export const BBOX = { west: 73.55, south: 33.05, east: 73.85, north: 33.25 };

export type BandKey = "blue" | "green" | "red" | "nir" | "swir1" | "swir2";
export const BANDS: BandKey[] = ["blue", "green", "red", "nir", "swir1", "swir2"];
export const BAND_LABEL: Record<BandKey, string> = {
  blue: "B2 blue",
  green: "B3 green",
  red: "B4 red",
  nir: "B8 NIR",
  swir1: "B11 SWIR1",
  swir2: "B12 SWIR2",
};

// Dynamic World classes and their official colours.
export const DW = [
  { name: "Water", color: "#419bdf" },
  { name: "Trees", color: "#397d49" },
  { name: "Grass", color: "#88b053" },
  { name: "Flooded vegetation", color: "#7a87c6" },
  { name: "Crops", color: "#e49635" },
  { name: "Shrub and scrub", color: "#dfc35a" },
  { name: "Built area", color: "#c4281b" },
  { name: "Bare ground", color: "#a59b8f" },
  { name: "Snow and ice", color: "#b39fe1" },
];

// Typical reflectance per class: blue, green, red, nir, swir1, swir2.
const SIGNATURE: number[][] = [
  [0.05, 0.07, 0.04, 0.02, 0.012, 0.008],
  [0.035, 0.062, 0.042, 0.36, 0.16, 0.07],
  [0.045, 0.085, 0.07, 0.3, 0.24, 0.13],
  [0.04, 0.07, 0.05, 0.18, 0.08, 0.04],
  [0.05, 0.09, 0.07, 0.42, 0.22, 0.11],
  [0.06, 0.085, 0.09, 0.25, 0.3, 0.2],
  [0.09, 0.1, 0.115, 0.19, 0.25, 0.21],
  [0.075, 0.1, 0.12, 0.22, 0.29, 0.24],
  [0.85, 0.85, 0.82, 0.7, 0.1, 0.06],
];

function hash(x: number, y: number, seed: number) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}

function fbm(x: number, y: number, seed: number) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    v += amp * noise(x * f, y * f, seed + i);
    amp /= 2;
    f *= 2;
  }
  return v;
}

export type Scene = {
  bands: Record<BandKey, Float32Array>;
  classes: Uint8Array;
};

let cached: Scene | null = null;

export function makeScene(): Scene {
  if (cached) return cached;
  const n = W * H;
  const bands = Object.fromEntries(BANDS.map((b) => [b, new Float32Array(n)])) as Record<BandKey, Float32Array>;
  const classes = new Uint8Array(n);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const elev = fbm(x / 26, y / 26, 7);
      const wet = fbm(x / 14, y / 14, 31);
      const grain = fbm(x / 4, y / 4, 99);
      // Reservoir: a lobed blob on the left; river: a meander to the right edge.
      const lake = Math.hypot((x - 34) / 24, (y - 44) / 16) + (fbm(x / 9, y / 9, 3) - 0.5) * 0.6;
      const riverY = 46 + Math.sin(x / 11) * 7 + Math.sin(x / 4.3) * 1.5;
      const river = x > 52 && Math.abs(y - riverY) < 1.6 + (x - 52) / 60;
      const town = Math.hypot((x - 92) / 13, (y - 22) / 9) + (grain - 0.5) * 0.7;
      const fieldsBand = y > 54 && x > 50 && x < 124;

      let c: number;
      if (lake < 1) c = 0;
      else if (river) c = 0;
      else if (lake < 1.12 && wet > 0.45) c = 3;
      else if (town < 1) c = 6;
      else if (elev > 0.62) c = elev > 0.7 && grain > 0.55 ? 7 : 1;
      else if (fieldsBand) c = hash(Math.floor(x / 9), Math.floor(y / 7), 11) < 0.12 ? 7 : 4;
      else if (wet > 0.56) c = 2;
      else if (wet < 0.38) c = 5;
      else c = elev > 0.55 ? 1 : 2;
      classes[i] = c;

      const sig = SIGNATURE[c];
      // Crops vary field by field (green, ripening, harvested).
      const vigour = c === 4 ? 0.65 + 0.7 * hash(Math.floor(x / 9), Math.floor(y / 7), 5) : 1;
      for (let b = 0; b < 6; b++) {
        let v = sig[b] * (0.72 + 0.56 * grain);
        if (b === 3) v *= vigour;
        if (b === 2 && c === 4) v *= 2 - vigour;
        // Haze over the lake edge, deeper water darker.
        if (c === 0) v *= 1.15 - Math.min(0.4, (1 - Math.min(1, lake)) * 0.5);
        bands[BANDS[b]][i] = v;
      }
    }
  }
  cached = { bands, classes };
  return cached;
}

export function percentile(arr: Float32Array, p: number) {
  const sorted = Float32Array.from(arr).sort();
  return sorted[Math.floor((sorted.length - 1) * p)];
}

export type ViewKey = "true" | "false" | "ndvi" | "ndwi" | "lc" | "ndviStretched" | BandKey;

export const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "true", label: "True colour" },
  { key: "false", label: "False colour" },
  { key: "ndvi", label: "NDVI" },
  { key: "ndwi", label: "NDWI" },
  { key: "lc", label: "Land cover" },
  ...BANDS.map((b) => ({ key: b as ViewKey, label: BAND_LABEL[b] })),
];

type Stop = [number, string];
export const NDVI_RAMP: Stop[] = [
  [0, "#a50026"],
  [0.25, "#f46d43"],
  [0.5, "#fee08b"],
  [0.75, "#66bd63"],
  [1, "#006837"],
];
export const NDWI_RAMP: Stop[] = [
  [0, "#8c510a"],
  [0.4, "#f6e8c3"],
  [0.55, "#c7eae5"],
  [1, "#08519c"],
];
export const BAND_RAMP: Stop[] = [
  [0, "#440154"],
  [0.25, "#3b528b"],
  [0.5, "#21918c"],
  [0.75, "#5ec962"],
  [1, "#fde725"],
];

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ramp(stops: Stop[], t: number): [number, number, number] {
  const v = Math.min(1, Math.max(0, t));
  for (let k = 1; k < stops.length; k++) {
    if (v <= stops[k][0]) {
      const [t0, c0] = stops[k - 1];
      const [t1, c1] = stops[k];
      const u = (v - t0) / (t1 - t0 || 1);
      const a = hexRgb(c0);
      const b = hexRgb(c1);
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }
  }
  return hexRgb(stops[stops.length - 1][1]);
}

export const rampCss = (stops: Stop[]) =>
  `linear-gradient(90deg, ${stops.map(([t, c]) => `${c} ${Math.round(t * 100)}%`).join(", ")})`;

export const nd = (a: number, b: number) => (a + b === 0 ? 0 : (a - b) / (a + b));

/** The RGBA pixels of a view, plus what its legend shows. */
export function render(view: ViewKey) {
  const s = makeScene();
  const out = new Uint8ClampedArray(W * H * 4);
  const put = (i: number, rgb: [number, number, number]) => {
    out[i * 4] = rgb[0];
    out[i * 4 + 1] = rgb[1];
    out[i * 4 + 2] = rgb[2];
    out[i * 4 + 3] = 255;
  };
  const stretch = (b: BandKey) => {
    const lo = percentile(s.bands[b], 0.02);
    const hi = percentile(s.bands[b], 0.98);
    return (v: number) => Math.min(255, Math.max(0, ((v - lo) / (hi - lo || 1)) * 255));
  };
  let range: [number, number] | null = null;
  let stops: Stop[] | null = null;

  if (view === "true" || view === "false") {
    const order: BandKey[] = view === "true" ? ["red", "green", "blue"] : ["nir", "red", "green"];
    const fns = order.map(stretch);
    for (let i = 0; i < W * H; i++) put(i, [fns[0](s.bands[order[0]][i]), fns[1](s.bands[order[1]][i]), fns[2](s.bands[order[2]][i])]);
  } else if (view === "ndvi") {
    range = [-0.2, 0.8];
    stops = NDVI_RAMP;
    for (let i = 0; i < W * H; i++) put(i, ramp(NDVI_RAMP, (nd(s.bands.nir[i], s.bands.red[i]) + 0.2) / 1));
  } else if (view === "ndwi") {
    range = [-0.5, 0.5];
    stops = NDWI_RAMP;
    for (let i = 0; i < W * H; i++) put(i, ramp(NDWI_RAMP, nd(s.bands.green[i], s.bands.nir[i]) + 0.5));
  } else if (view === "ndviStretched") {
    // NDVI on the general colour scale, stretched to its own values (the viewer's switch turned off).
    const v = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) v[i] = nd(s.bands.nir[i], s.bands.red[i]);
    const lo = percentile(v, 0.02);
    const hi = percentile(v, 0.98);
    range = [lo, hi];
    stops = BAND_RAMP;
    for (let i = 0; i < W * H; i++) put(i, ramp(BAND_RAMP, (v[i] - lo) / (hi - lo || 1)));
  } else if (view === "lc") {
    for (let i = 0; i < W * H; i++) put(i, hexRgb(DW[s.classes[i]].color));
  } else {
    const lo = percentile(s.bands[view], 0.02);
    const hi = percentile(s.bands[view], 0.98);
    range = [lo, hi];
    stops = BAND_RAMP;
    for (let i = 0; i < W * H; i++) put(i, ramp(BAND_RAMP, (s.bands[view][i] - lo) / (hi - lo || 1)));
  }
  return { pixels: out, range, stops };
}

const urls = new Map<ViewKey, string>();

/** A view of the scene as a PNG data URL, for pictures that are not interactive. */
export function viewUrl(view: ViewKey): string {
  if (typeof document === "undefined") return "";
  const hit = urls.get(view);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  c.getContext("2d")?.putImageData(new ImageData(render(view).pixels, W, H), 0, 0);
  const url = c.toDataURL();
  urls.set(view, url);
  return url;
}
