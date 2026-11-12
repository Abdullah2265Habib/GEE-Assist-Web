/**
 * A procedural "satellite scene" for the scroll story: farm parcels, a river,
 * a town and roads, with surface reflectance in four bands (red, green, blue,
 * near-infrared). Everything the story shows (the lens view, the decoded
 * image, the band split, NDVI and the basemap) is computed from this one
 * scene, so the pictures agree with each other the way real data would.
 */

export const WORLD_W = 384;
export const WORLD_H = 288;
/** The analysed area, a crop of the world, in world pixels. */
export const CROP = { x: 192, y: 96, size: 128 };

type Cls = "veg" | "soil" | "water" | "urban" | "road";

interface Pixel {
  cls: Cls;
  r: number;
  g: number;
  b: number;
  nir: number;
}

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1]. */
function noise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

function fbm(x: number, y: number, scale: number, seed: number): number {
  return 0.55 * noise(x, y, scale, seed) + 0.3 * noise(x, y, scale / 2, seed + 1) + 0.15 * noise(x, y, scale / 4, seed + 2);
}

/** Surface reflectance (0..1) of one ground location. Works for any x, y. */
export function sample(x: number, y: number): Pixel {
  // River: a meander running roughly north to south.
  const riverX = 120 + 46 * Math.sin(y / 41) + 22 * Math.sin(y / 17 + 1.3) + 30 * (fbm(0, y, 60, 7) - 0.5);
  const riverDist = Math.abs(x - riverX);
  if (riverDist < 4.2 + 2 * noise(x, y, 20, 3)) {
    const t = noise(x, y, 6, 11) * 0.02;
    return { cls: "water", r: 0.035 + t, g: 0.06 + t, b: 0.09 + t, nir: 0.015 };
  }

  // Town: a blob east of the river.
  const tx = x - 290;
  const ty = y - 150;
  const town = Math.sqrt(tx * tx * 0.8 + ty * ty) + 34 * (fbm(x, y, 18, 5) - 0.5);
  if (town < 42) {
    const t = hash(x >> 1, y >> 1, 9) * 0.08;
    const park = noise(x, y, 7, 21) > 0.78;
    if (park) return { cls: "veg", r: 0.05, g: 0.09, b: 0.05, nir: 0.36 };
    return { cls: "urban", r: 0.22 + t, g: 0.21 + t, b: 0.21 + t, nir: 0.25 + t * 0.5 };
  }

  // Field parcels on a slightly wobbly grid, with roads every few parcels.
  const wx = x + 6 * (noise(x, y, 50, 13) - 0.5);
  const wy = y + 6 * (noise(x, y, 50, 17) - 0.5);
  const cw = 14;
  const ch = 11;
  const px = Math.floor(wx / cw);
  const py = Math.floor(wy / ch);
  const lx = wx - px * cw;
  const ly = wy - py * ch;
  const roadX = px % 5 === 0 && lx < 1.3;
  const roadY = py % 6 === 0 && ly < 1.3;
  if (roadX || roadY) return { cls: "road", r: 0.3, g: 0.28, b: 0.25, nir: 0.31 };
  const edge = lx < 0.7 || ly < 0.7;

  // Crop vigour per parcel, plus some in-field variation; wetter near the river.
  const vig = Math.min(1, Math.max(0, hash(px, py, 31) * 0.95 + 0.25 * Math.exp(-riverDist / 60) + 0.2 * (noise(x, y, 5, 41) - 0.5)));
  if (vig < 0.22 || edge) {
    const t = noise(x, y, 4, 51) * 0.05;
    return { cls: "soil", r: 0.24 + t, g: 0.2 + t, b: 0.15 + t, nir: 0.29 + t };
  }
  return { cls: "veg", r: 0.16 - 0.12 * vig, g: 0.15 - 0.05 * vig, b: 0.11 - 0.07 * vig, nir: 0.24 + 0.36 * vig };
}

const toByte = (v: number) => Math.max(0, Math.min(255, Math.round(Math.pow(Math.max(0, v) * 3.2, 0.82) * 255)));

function lerpColor(stops: [number, [number, number, number]][], v: number): [number, number, number] {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      return [0, 1, 2].map((k) => Math.round(ca[k] + (cb[k] - ca[k]) * t)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

/** The NDVI colour ramp used on the picture and in its legend. */
export const NDVI_STOPS: [number, [number, number, number]][] = [
  [-0.4, [59, 110, 168]],
  [0.0, [140, 120, 90]],
  [0.15, [201, 166, 107]],
  [0.3, [230, 224, 138]],
  [0.5, [145, 207, 96]],
  [0.75, [26, 152, 80]],
];

export function ndviOf(p: Pixel): number {
  return (p.nir - p.r) / (p.nir + p.r + 1e-6);
}

const BASEMAP: Record<Cls, [number, number, number]> = {
  veg: [200, 226, 190],
  soil: [232, 226, 206],
  water: [150, 196, 230],
  urban: [214, 210, 214],
  road: [255, 255, 255],
};

function render(w: number, h: number, ox: number, oy: number, px: (p: Pixel) => [number, number, number]): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(sample(x + ox, y + oy));
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export interface Scene {
  /** True-colour crop (CROP.size square). */
  trueColor: string;
  /** One picture per band, drawn in that band's colour. */
  bands: { id: string; label: string; colour: string; url: string }[];
  ndvi: string;
  /** Flat cartographic map of the whole world. */
  basemap: string;
  /** A long true-colour strip for the lens view. */
  strip: string;
  stripHeight: number;
  /** Raw bytes of each crop row (R, G, B per pixel), for the binary read-out. */
  rowBytes: (row: number) => number[];
}

export function buildScene(): Scene {
  const { x: cx, y: cy, size } = CROP;
  const tc = (p: Pixel): [number, number, number] => [toByte(p.r), toByte(p.g), toByte(p.b)];
  const band = (k: "r" | "g" | "b" | "nir", tint: [number, number, number]) => (p: Pixel): [number, number, number] => {
    const v = toByte(p[k] * (k === "nir" ? 0.55 : 1)) / 255;
    return [Math.round(tint[0] * v), Math.round(tint[1] * v), Math.round(tint[2] * v)];
  };
  const stripHeight = 512;
  return {
    trueColor: render(size, size, cx, cy, tc),
    bands: [
      { id: "B4", label: "B4 · red", colour: "#ff6b5e", url: render(size, size, cx, cy, band("r", [255, 90, 80])) },
      { id: "B3", label: "B3 · green", colour: "#6fe38f", url: render(size, size, cx, cy, band("g", [90, 255, 130])) },
      { id: "B2", label: "B2 · blue", colour: "#6cb8f0", url: render(size, size, cx, cy, band("b", [90, 160, 255])) },
      { id: "B8", label: "B8 · near-IR", colour: "#d7a6ff", url: render(size, size, cx, cy, band("nir", [225, 170, 255])) },
    ],
    ndvi: render(size, size, cx, cy, (p) => lerpColor(NDVI_STOPS, ndviOf(p))),
    basemap: render(WORLD_W, WORLD_H, 0, 0, (p) => BASEMAP[p.cls]),
    strip: render(160, stripHeight, 40, -200, tc),
    stripHeight,
    rowBytes: (row: number) => {
      const out: number[] = [];
      for (let x = 0; x < 4; x++) {
        const [r, g, b] = tc(sample(cx + x * 31, cy + row));
        out.push(r, g, b);
      }
      return out;
    },
  };
}
